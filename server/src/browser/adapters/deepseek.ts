import { Page } from 'playwright'
import { SiteAdapter, DeepSeekConfig, ModelConfig, waitFor } from './base.js'

// All DeepSeek selectors — update here if UI changes
// Toggle buttons verified against live chat.deepseek.com DOM on 2026-05-10
const SEL = {
  newChatButton: 'button:has-text("New Chat"), [class*="newChat"], a:has-text("新对话"), button:has-text("新建对话")',
  // DeepSeek uses a <textarea> for input
  inputBox: 'textarea#chat-input, textarea[class*="chat"], textarea[class*="input"], textarea[placeholder]',
  sendButton: 'button[aria-label="send"], [class*="sendButton"]:not([class*="cancel"]), button[class*="send"]:not([class*="cancel"])',
  // Feature toggle buttons in the toolbar below the input box
  // State: aria-pressed="true" or class ds-toggle-button--selected = currently active
  deepThinkBtn: 'div.ds-toggle-button[role="button"]:has-text("深度思考")',
  smartSearchBtn: 'div.ds-toggle-button[role="button"]:has-text("智能搜索")',
  // Response container selectors (in order of preference)
  responseContainerSelectors: [
    '[class*="ds-markdown"]',
    '[class*="markdown"]',
    '[class*="message-content"]:not([class*="user"])',
    '[class*="ai-message"]',
    '[class*="assistant"]',
  ],
}

export class DeepSeekAdapter implements SiteAdapter {
  readonly name = 'deepseek'
  private page!: Page

  setPage(page: Page) {
    this.page = page
  }

  // Set a toggle to a specific state (true = on/active, false = off/inactive)
  private async setToggle(selector: string, label: string, desiredOn: boolean): Promise<void> {
    try {
      const btn = this.page.locator(selector).first()
      await btn.waitFor({ timeout: 3000 })
      const pressed = await btn.getAttribute('aria-pressed').catch(() => null)
      const cls = await btn.getAttribute('class').catch(() => '')
      const currentlyOn = pressed === 'true' || (cls ?? '').includes('ds-toggle-button--selected')
      if (currentlyOn !== desiredOn) {
        await btn.click()
        await waitFor(400)
        console.log(`[deepseek] ${desiredOn ? 'enabled' : 'disabled'}: ${label}`)
      } else {
        console.log(`[deepseek] ${label} already ${desiredOn ? 'on' : 'off'}, no change`)
      }
    } catch {
      console.warn(`[deepseek] configure: cannot find toggle "${label}" — skipping`)
    }
  }

  async configure(config: ModelConfig): Promise<void> {
    const cfg = config as DeepSeekConfig
    await waitFor(600)  // let input toolbar settle after newConversation

    // "专家模式" = deepThink ON; "快速模式" = deepThink OFF
    // In DeepSeek UI there is no separate R1/V3 selector — only the 深度思考 toggle
    const wantDeepThink = cfg.mode === 'expert' || cfg.deepThink
    await this.setToggle(SEL.deepThinkBtn, '深度思考', wantDeepThink)
    await this.setToggle(SEL.smartSearchBtn, '智能搜索', cfg.smartSearch)
  }

  async ensureReady(): Promise<void> {
    if (!this.page.url().startsWith('https://chat.deepseek.com')) {
      await this.page.goto('https://chat.deepseek.com', { waitUntil: 'domcontentloaded' })
    }
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  }

  async newConversation(): Promise<void> {
    await this.ensureReady()
    try {
      const btn = this.page.locator(SEL.newChatButton).first()
      await btn.waitFor({ timeout: 5000 })
      await btn.click()
      await waitFor(800)
    } catch {
      await this.page.goto('https://chat.deepseek.com', { waitUntil: 'domcontentloaded' })
      await waitFor(800)
    }
    await this.page.locator(SEL.inputBox).waitFor({ timeout: 10_000 }).catch(() => {})
  }

  async sendMessage(text: string): Promise<void> {
    const input = this.page.locator(SEL.inputBox).first()
    await input.waitFor({ timeout: 10_000 })
    await input.fill(text)
    await waitFor(400)

    // Try send button first, fallback to Enter
    const sendBtn = this.page.locator(SEL.sendButton).first()
    const btnVisible = await sendBtn.isVisible().catch(() => false)
    if (btnVisible) {
      await sendBtn.click()
    } else {
      await this.page.keyboard.press('Enter')
    }
  }

  async streamResponse(onDelta: (chunk: string) => void): Promise<string> {
    const HARD_TIMEOUT = Date.now() + 5 * 60 * 1000
    const STABILITY_MS = 2500

    // Returns [count-of-outermost, text-of-last-outermost]
    // DeepSeek nests ds-markdown inside ds-markdown; we only want top-level containers.
    const getState = (): Promise<[number, string]> =>
      this.page.evaluate((selectors) => {
        for (const sel of selectors) {
          const all = document.querySelectorAll(sel)
          const outermost: Element[] = []
          for (let i = 0; i < all.length; i++) {
            let nested = false
            for (let j = 0; j < all.length; j++) {
              if (j !== i && all[j] !== all[i] && all[j].contains(all[i])) {
                nested = true
                break
              }
            }
            if (!nested) outermost.push(all[i])
          }
          if (outermost.length > 0) {
            const last = outermost[outermost.length - 1] as HTMLElement
            return [outermost.length, last.innerText ?? ''] as [number, string]
          }
        }
        return [0, ''] as [number, string]
      }, SEL.responseContainerSelectors)

    // Baseline: top-level response containers already on screen (same-session continuity)
    const [baselineCount] = await getState()

    // Phase 1: wait for a new outermost ds-markdown to appear (up to 30s)
    const deadline1 = Date.now() + 30_000
    while (Date.now() < deadline1) {
      const [count] = await getState()
      if (count > baselineCount) break
      await waitFor(400)
    }

    // Phase 2: content-stability detection on the last outermost container
    let lastText = ''
    let lastChangeAt = Date.now()

    while (Date.now() < HARD_TIMEOUT) {
      const [, current] = await getState()
      if (current !== lastText) {
        const delta = current.slice(lastText.length)
        if (delta) onDelta(delta)
        lastText = current
        lastChangeAt = Date.now()
      }

      if (lastText.length > 0 && Date.now() - lastChangeAt >= STABILITY_MS) {
        return lastText
      }

      await waitFor(400)
    }

    return lastText
  }
}
