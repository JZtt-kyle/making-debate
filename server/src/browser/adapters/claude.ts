import { Page } from 'playwright'
import { SiteAdapter, humanType, waitFor } from './base.js'

const SEL = {
  newChatButton: '[data-testid="new-chat-button"], a[href="/new"], button:has-text("New chat")',
  inputBox: '[contenteditable="true"][data-placeholder]',
  sendButton: 'button[aria-label="Send message"]',
  stopButton: 'button[aria-label="Stop"]',
  lastMessage: '[data-testid="user-message"] ~ * [data-testid="message-content"], .font-claude-message',
  responseContainer: '.font-claude-message, [data-testid="message-content"]',
}

export class ClaudeAdapter implements SiteAdapter {
  readonly name = 'claude'
  private page!: Page

  setPage(page: Page) {
    this.page = page
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
      const btn = this.page.locator(SEL.newChatButton).first()
      await btn.waitFor({ timeout: 5000 })
      await btn.click()
      await waitFor(800)
    } catch {
      await this.page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded' })
      await waitFor(800)
    }
  }

  async sendMessage(text: string): Promise<void> {
    const input = this.page.locator(SEL.inputBox).first()
    await input.waitFor({ timeout: 10_000 })
    await input.click()
    await waitFor(200)

    // use clipboard paste for long texts to avoid timing issues
    await this.page.evaluate((t) => {
      const el = document.querySelector('[contenteditable="true"][data-placeholder]') as HTMLElement
      if (el) {
        el.focus()
        const selection = window.getSelection()
        selection?.selectAllChildren(el)
        selection?.deleteFromDocument()
        // insert as text node
        document.execCommand('insertText', false, t)
      }
    }, text)

    await waitFor(300)
    const sendBtn = this.page.locator(SEL.sendButton).first()
    await sendBtn.waitFor({ timeout: 5000 })
    await sendBtn.click()
  }

  async streamResponse(onDelta: (chunk: string) => void): Promise<string> {
    // wait for response to start (stop button appears)
    await this.page.locator(SEL.stopButton).waitFor({ timeout: 30_000 }).catch(() => {})

    let lastText = ''
    const getLastResponseText = async (): Promise<string> => {
      return this.page.evaluate(() => {
        const messages = document.querySelectorAll('.font-claude-message, [data-testid="message-content"]')
        const last = messages[messages.length - 1]
        return last?.textContent ?? ''
      })
    }

    // poll until stop button disappears
    while (true) {
      const current = await getLastResponseText()
      if (current !== lastText) {
        const delta = current.slice(lastText.length)
        if (delta) onDelta(delta)
        lastText = current
      }

      const stopVisible = await this.page.locator(SEL.stopButton).isVisible().catch(() => false)
      if (!stopVisible) {
        // one more read to capture trailing content
        await waitFor(500)
        const final = await getLastResponseText()
        if (final !== lastText) onDelta(final.slice(lastText.length))
        return final
      }
      await waitFor(300)
    }
  }
}
