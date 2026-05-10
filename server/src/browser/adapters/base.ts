import { Page } from 'playwright'

export interface DeepSeekConfig {
  mode: 'fast' | 'expert'   // 快速(V3) vs 专家(R1)
  deepThink: boolean         // 深度思考
  smartSearch: boolean       // 智能搜索
}

export interface ClaudeConfig {
  model: 'sonnet-4-6' | 'opus-4-7'
}

export type ModelConfig = DeepSeekConfig | ClaudeConfig | Record<string, never>

export interface SiteAdapter {
  readonly name: string
  setPage(page: Page): void
  ensureReady(): Promise<void>
  newConversation(): Promise<void>
  sendMessage(text: string): Promise<void>
  streamResponse(onDelta: (chunk: string) => void): Promise<string>
  configure?(config: ModelConfig): Promise<void>
}

export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.focus(selector)
  for (const char of text) {
    await page.keyboard.type(char, { delay: Math.floor(Math.random() * 50) + 20 })
  }
}

export async function waitFor(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
