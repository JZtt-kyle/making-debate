import { Page } from 'playwright'
import { SiteAdapter, waitFor } from './base.js'

const SEL = {
  newChatButton: 'button:has-text("New Chat"), a:has-text("New Chat"), [class*="newChat"]',
  inputBox: 'textarea#chat-input, textarea[placeholder*="Send"], textarea[class*="input"]',
  sendButton: 'button[type="submit"], button:has-text("Send"), [class*="sendButton"]',
  stopButton: 'button:has-text("Stop"), [class*="stop"]',
  lastAssistantMessage: '[class*="assistant"] [class*="content"], [class*="message"]:last-child',
}

export class DeepSeekAdapter implements SiteAdapter {
  readonly name = 'deepseek'
  private page!: Page

  setPage(page: Page) {
    this.page = page
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
  }

  async sendMessage(text: string): Promise<void> {
    const input = this.page.locator(SEL.inputBox).first()
    await input.waitFor({ timeout: 10_000 })
    await input.click()
    await waitFor(200)

    await this.page.evaluate((t) => {
      const el = document.querySelector('textarea#chat-input, textarea') as HTMLTextAreaElement
      if (el) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
        nativeInputValueSetter?.call(el, t)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, text)

    await waitFor(400)
    // try button click, fallback to Enter
    const sendBtn = this.page.locator(SEL.sendButton).first()
    const btnVisible = await sendBtn.isVisible().catch(() => false)
    if (btnVisible) {
      await sendBtn.click()
    } else {
      await this.page.keyboard.press('Enter')
    }
  }

  async streamResponse(onDelta: (chunk: string) => void): Promise<string> {
    // wait for response to appear
    await waitFor(1000)
    await this.page.locator(SEL.stopButton).waitFor({ timeout: 30_000 }).catch(() => {})

    let lastText = ''
    const getText = async (): Promise<string> => {
      return this.page.evaluate(() => {
        const messages = document.querySelectorAll('[class*="assistant"], [class*="message"]')
        const last = messages[messages.length - 1]
        return last?.textContent ?? ''
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
