import { Page } from 'playwright'

export interface SiteAdapter {
  readonly name: string
  setPage(page: Page): void
  ensureReady(): Promise<void>
  newConversation(): Promise<void>
  sendMessage(text: string): Promise<void>
  streamResponse(onDelta: (chunk: string) => void): Promise<string>
}

export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.focus(selector)
  // type in chunks with human-like delay
  for (const char of text) {
    await page.keyboard.type(char, { delay: Math.floor(Math.random() * 50) + 20 })
  }
}

export async function waitFor(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
