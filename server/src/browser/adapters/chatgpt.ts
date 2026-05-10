import { Page } from 'playwright'
import { SiteAdapter, waitFor } from './base.js'

const SEL = {
  newChatButton: 'a[href="/"], nav button:has-text("New chat"), [data-testid="create-new-chat-button"]',
  inputBox: '#prompt-textarea, [contenteditable="true"][placeholder]',
  sendButton: '[data-testid="send-button"], button[aria-label="Send prompt"]',
  stopButton: 'button[aria-label="Stop streaming"]',
  lastAssistantMessage: '[data-message-author-role="assistant"]:last-child .markdown',
}

export class ChatGPTAdapter implements SiteAdapter {
  readonly name = 'chatgpt'
  private page!: Page

  setPage(page: Page) {
    this.page = page
  }

  async ensureReady(): Promise<void> {
    if (!this.page.url().startsWith('https://chatgpt.com') && !this.page.url().startsWith('https://chat.openai.com')) {
      await this.page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded' })
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
      await this.page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' })
      await waitFor(800)
    }
  }

  async sendMessage(text: string): Promise<void> {
    const input = this.page.locator(SEL.inputBox).first()
    await input.waitFor({ timeout: 10_000 })
    await input.click()
    await waitFor(200)

    await this.page.evaluate((t) => {
      const el = document.querySelector('#prompt-textarea, [contenteditable="true"][placeholder]') as HTMLElement
      if (el) {
        el.focus()
        if (el.tagName === 'TEXTAREA') {
          ;(el as HTMLTextAreaElement).value = t
          el.dispatchEvent(new Event('input', { bubbles: true }))
        } else {
          document.execCommand('selectAll', false)
          document.execCommand('insertText', false, t)
        }
      }
    }, text)

    await waitFor(400)
    const sendBtn = this.page.locator(SEL.sendButton).first()
    await sendBtn.waitFor({ timeout: 5000 })
    await sendBtn.click()
  }

  async streamResponse(onDelta: (chunk: string) => void): Promise<string> {
    await this.page.locator(SEL.stopButton).waitFor({ timeout: 30_000 }).catch(() => {})

    let lastText = ''
    const getText = async (): Promise<string> => {
      return this.page.evaluate(() => {
        const messages = document.querySelectorAll('[data-message-author-role="assistant"]')
        const last = messages[messages.length - 1]
        return last?.querySelector('.markdown')?.textContent ?? last?.textContent ?? ''
      })
    }

    while (true) {
      const current = await getText()
      if (current !== lastText) {
        const delta = current.slice(lastText.length)
        if (delta) onDelta(delta)
        lastText = current
      }

      const stopVisible = await this.page.locator(SEL.stopButton).isVisible().catch(() => false)
      if (!stopVisible) {
        await waitFor(500)
        const final = await getText()
        if (final !== lastText) onDelta(final.slice(lastText.length))
        return final
      }
      await waitFor(300)
    }
  }
}
