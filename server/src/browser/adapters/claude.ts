import { Page } from 'playwright'
import { SiteAdapter, ClaudeConfig, ModelConfig, waitFor } from './base.js'
import { htmlToMarkdown } from '../markdown.js'

// All Claude selectors — update here if UI changes
// Verified against live claude.ai DOM on 2026-05-10
const SEL = {
  newChatButton: 'a[href="/new"]',
  // Claude uses a contenteditable div (data-testid="chat-input")
  inputBox: '[data-testid="chat-input"]',
  sendButton: 'button[aria-label="Send message"], button[aria-label="Send Message"], button[aria-label*="Send"]',
  // Response is in .font-claude-response divs; body paragraphs in .font-claude-response-body
  // Use .font-claude-response (parent div) to capture multi-paragraph responses
  responseSelector: '.font-claude-response',
  responseBodySelector: '.font-claude-response-body',
  // Model picker — the button that opens the model selection popover
  modelPickerBtn: '[data-testid="model-selector-dropdown"], button[aria-label*="model" i], button[aria-haspopup][class*="model"], button:has-text("Claude 4")',
}

export class ClaudeAdapter implements SiteAdapter {
  readonly name = 'claude'
  private page!: Page

  setPage(page: Page) {
    this.page = page
  }

  async configure(config: ModelConfig): Promise<void> {
    const cfg = config as ClaudeConfig
    // Default is sonnet — only act when opus is requested
    if (cfg.model !== 'opus-4-7') return
    try {
      await waitFor(600)
      const btn = this.page.locator(SEL.modelPickerBtn).first()
      await btn.waitFor({ timeout: 5000 })
      await btn.click()
      await waitFor(600)

      // Opus may be hidden behind a "More models" button — check both paths
      const opusItem = this.page.locator('[role="menuitemradio"]:has-text("Opus"), [role="option"]:has-text("Opus")').first()
      const directlyVisible = await opusItem.isVisible().catch(() => false)

      if (!directlyVisible) {
        // "More models" is a [role="menuitem"] with aria-haspopup="menu"
        const moreBtn = this.page.locator('[role="menu"] [role="menuitem"][aria-haspopup="menu"], [role="menu"] [role="menuitem"]:has-text("More models")').first()
        const moreBtnVisible = await moreBtn.isVisible().catch(() => false)
        if (moreBtnVisible) {
          await moreBtn.click()
          await waitFor(600)
        }
      }

      await opusItem.waitFor({ timeout: 4000 })
      await opusItem.click()
      await waitFor(400)
      console.log('[claude] switched to Opus 4.7')
    } catch {
      console.warn('[claude] configure: cannot find model picker or Opus option — using default')
    }
  }

  async ensureReady(): Promise<void> {
    if (!this.page.url().startsWith('https://claude.ai')) {
      await this.page.goto('https://claude.ai', { waitUntil: 'domcontentloaded' })
    }
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  }

  async newConversation(): Promise<void> {
    await this.ensureReady()
    try {
      const link = this.page.locator(SEL.newChatButton).first()
      await link.waitFor({ timeout: 5000 })
      await link.click()
      await waitFor(1000)
    } catch {
      await this.page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded' })
      await waitFor(1000)
    }
    await this.page.locator(SEL.inputBox).waitFor({ timeout: 10_000 }).catch(() => {})
  }

  async sendMessage(text: string): Promise<void> {
    const input = this.page.locator(SEL.inputBox).first()
    await input.waitFor({ timeout: 10_000 })
    await input.click()
    await waitFor(200)
    // contenteditable: select all then insert new text
    await this.page.evaluate((t) => {
      const el = document.querySelector('[data-testid="chat-input"]') as HTMLElement
      if (!el) return
      el.focus()
      document.execCommand('selectAll', false)
      document.execCommand('insertText', false, t)
    }, text)
    await waitFor(300)
    const sendBtn = this.page.locator(SEL.sendButton).first()
    await sendBtn.waitFor({ timeout: 5000 })
    await sendBtn.click()
  }

  async streamResponse(onDelta: (chunk: string) => void): Promise<string> {
    const HARD_TIMEOUT = Date.now() + 5 * 60 * 1000
    const STABILITY_MS = 2500

    // Count existing responses before this message (in case conversation has history)
    const baselineCount = await this.page.evaluate(
      (sel) => document.querySelectorAll(sel).length,
      SEL.responseSelector
    )

    // getHtml: outerHTML of the LAST .font-claude-response element that
    // appeared AFTER our message was sent. We turn the HTML into Markdown
    // server-side so structural elements (headings, lists, code, tables)
    // survive into the UI.
    const getHtml = (): Promise<string> =>
      this.page.evaluate(({ sel, baseline }) => {
        const els = document.querySelectorAll(sel)
        const target = els[Math.max(els.length - 1, baseline)]
        return (target as HTMLElement)?.outerHTML ?? ''
      }, { sel: SEL.responseSelector, baseline: baselineCount })

    const getText = async (): Promise<string> => htmlToMarkdown(await getHtml())

    // Phase 1: wait for the new response element to appear (up to 30s)
    const deadline1 = Date.now() + 30_000
    while (Date.now() < deadline1) {
      const count = await this.page.evaluate(
        (sel) => document.querySelectorAll(sel).length,
        SEL.responseSelector
      )
      if (count > baselineCount) break
      await waitFor(300)
    }

    // Phase 2: content-stability detection
    let lastText = ''
    let lastChangeAt = Date.now()

    while (Date.now() < HARD_TIMEOUT) {
      const current = await getText()
      if (current !== lastText) {
        const delta = current.slice(lastText.length)
        if (delta) onDelta(delta)
        lastText = current
        lastChangeAt = Date.now()
      }

      if (lastText.length > 0 && Date.now() - lastChangeAt >= STABILITY_MS) {
        return lastText
      }

      await waitFor(300)
    }

    return lastText
  }
}
