import express from 'express'
import cors from 'cors'
import http from 'http'
import { launchBrowser } from './browser/launcher.js'
import { CDPSession } from './browser/cdp.js'
import { attachWebSocket } from './api/ws.js'
import { createRouter } from './api/http.js'

const PORT = Number(process.env.PORT ?? 3001)

async function main() {
  console.log('[server] Launching browser...')
  const { port: cdpPort, isFirstRun } = await launchBrowser()

  const cdp = new CDPSession()
  await cdp.connect(cdpPort)

  if (isFirstRun) {
    console.log('\n[server] First run detected!')
    console.log('[server] Please log into ChatGPT, Claude, and DeepSeek in the browser window,')
    console.log('[server] then click "已登录" in the web UI to continue.\n')
  }

  const app = express()
  app.use(cors())
  const server = http.createServer(app)

  const wsClients = attachWebSocket(server)
  app.use('/api', createRouter(cdp, wsClients))

  server.listen(PORT, () => {
    console.log(`[server] API listening on http://localhost:${PORT}`)
    console.log(`[server] WebSocket on ws://localhost:${PORT}/ws/debates/:id`)
  })

  process.on('SIGINT', async () => {
    console.log('\n[server] Shutting down...')
    await cdp.disconnect()
    process.exit(0)
  })
}

main().catch(err => {
  console.error('[server] Fatal:', err)
  process.exit(1)
})
