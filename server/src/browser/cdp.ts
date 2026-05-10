import { chromium, Browser, BrowserContext, Page } from 'playwright'

type SiteName = 'chatgpt' | 'claude' | 'deepseek'

const SITE_URLS: Record<SiteName, string> = {
  chatgpt: 'https://chatgpt.com',
  claude: 'https://claude.ai',
  deepseek: 'https://chat.deepseek.com',
}

export class CDPSession {
  private browser!: Browser
  private context!: BrowserContext
  private pages: Map<SiteName, Page> = new Map()

  async connect(port: number): Promise<void> {
    this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    const contexts = this.browser.contexts()
    this.context = contexts[0] ?? await this.browser.newContext()
  }

  async ensurePage(site: SiteName): Promise<Page> {
    const existing = this.pages.get(site)
    if (existing && !existing.isClosed()) return existing

    // reuse an existing tab already on that domain
    for (const page of this.context.pages()) {
      if (page.url().startsWith(SITE_URLS[site])) {
        this.pages.set(site, page)
        return page
      }
    }

    const page = await this.context.newPage()
    await page.goto(SITE_URLS[site], { waitUntil: 'domcontentloaded' })
    this.pages.set(site, page)
    return page
  }

  getContext(): BrowserContext {
    return this.context
  }

  async checkLoginStatus(site: SiteName): Promise<boolean> {
    try {
      const page = await this.ensurePage(site)
      const url = page.url()
      const loginIndicators = ['/login', '/signin', '/auth', 'accounts.google']
      return !loginIndicators.some(i => url.includes(i))
    } catch {
      return false
    }
  }

  async allLoggedIn(): Promise<Record<SiteName, boolean>> {
    const sites: SiteName[] = ['chatgpt', 'claude', 'deepseek']
    const results = await Promise.all(sites.map(s => this.checkLoginStatus(s)))
    return Object.fromEntries(sites.map((s, i) => [s, results[i]])) as Record<SiteName, boolean>
  }

  async disconnect(): Promise<void> {
    await this.browser.close()
  }
}
