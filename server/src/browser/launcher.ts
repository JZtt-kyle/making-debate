import { spawn, ChildProcess } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import net from 'net'

const PROFILE_DIR = join(homedir(), '.making-debate', 'profile')
const BASE_PORT = 9222

const CHROME_PATHS_MAC = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]

const CHROME_PATHS_LINUX = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/microsoft-edge',
]

function findBrowserBinary(): string {
  const candidates = process.platform === 'linux' ? CHROME_PATHS_LINUX : CHROME_PATHS_MAC
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  throw new Error(
    'No Chrome/Edge installation found. Install Google Chrome or Microsoft Edge.'
  )
}

async function isPortFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port)
  })
}

async function findAvailablePort(start: number): Promise<number> {
  let port = start
  while (!(await isPortFree(port))) port++
  return port
}

async function waitForCDP(port: number, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`)
      return
    } catch {
      await new Promise(r => setTimeout(r, 300))
    }
  }
  throw new Error(`Chrome CDP not available on port ${port} after ${timeoutMs}ms`)
}

export interface BrowserLaunchResult {
  port: number
  process: ChildProcess
  isFirstRun: boolean
}

export async function launchBrowser(): Promise<BrowserLaunchResult> {
  const isFirstRun = !existsSync(PROFILE_DIR)
  if (isFirstRun) {
    mkdirSync(PROFILE_DIR, { recursive: true })
  }

  const binary = findBrowserBinary()
  const port = await findAvailablePort(BASE_PORT)

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--start-maximized',
  ]

  const proc = spawn(binary, args, {
    detached: false,
    stdio: 'ignore',
  })

  proc.on('error', err => {
    console.error('[launcher] Browser process error:', err.message)
  })

  await waitForCDP(port)
  console.log(`[launcher] Browser ready on CDP port ${port}`)

  return { port, process: proc, isFirstRun }
}
