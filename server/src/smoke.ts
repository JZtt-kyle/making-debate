// Usage: npm run smoke -- [claude|chatgpt|deepseek]
// Tests a single adapter by sending "你好" and printing the streamed response
import { launchBrowser } from './browser/launcher.js'
import { CDPSession } from './browser/cdp.js'
import { ClaudeAdapter } from './browser/adapters/claude.js'
import { ChatGPTAdapter } from './browser/adapters/chatgpt.js'
import { DeepSeekAdapter } from './browser/adapters/deepseek.js'
import { SiteAdapter } from './browser/adapters/base.js'

const target = (process.argv[2] ?? 'claude') as 'claude' | 'chatgpt' | 'deepseek'

const adapterMap: Record<string, SiteAdapter> = {
  claude: new ClaudeAdapter(),
  chatgpt: new ChatGPTAdapter(),
  deepseek: new DeepSeekAdapter(),
}

const adapter = adapterMap[target]
if (!adapter) {
  console.error('Unknown target:', target)
  process.exit(1)
}

console.log(`[smoke] Testing adapter: ${target}`)

const { port } = await launchBrowser()
const cdp = new CDPSession()
await cdp.connect(port)

const page = await cdp.ensurePage(target)
adapter.setPage(page)
await adapter.ensureReady()
await adapter.newConversation()

console.log('[smoke] Sending: 你好，请用一句话介绍你自己')
await adapter.sendMessage('你好，请用一句话介绍你自己')

process.stdout.write('[smoke] Response: ')
const full = await adapter.streamResponse(delta => process.stdout.write(delta))
process.stdout.write('\n')
console.log(`[smoke] Done. Total length: ${full.length} chars`)

await cdp.disconnect()
process.exit(0)
