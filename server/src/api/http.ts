import express, { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { runDebate, DEFAULT_MODEL_CONFIGS } from '../orchestrator/debate.js'
import type { WSEvent, ModelConfigs, DebatePhase } from '../orchestrator/debate.js'
import { CDPSession } from '../browser/cdp.js'
import { ADAPTER_REGISTRY, MODELS } from '../browser/adapters/index.js'
import type { ModelName } from '../browser/adapters/index.js'
import { debates, messages, summaries } from '../storage/repository.js'
import { parsePhase5Output } from '../orchestrator/parsers.js'

type WsClients = Map<string, Set<(event: WSEvent) => void>>

export function createRouter(cdp: CDPSession, wsClients: WsClients): Router {
  const router = Router()
  router.use(express.json())

  // POST /api/debates — create & start a new debate
  router.post('/debates', async (req, res) => {
    const { topic, principles = '', synthesizer, deepseekConfig, claudeConfig } = req.body as {
      topic?: string; principles?: string; synthesizer?: ModelName
      deepseekConfig?: ModelConfigs['deepseek']; claudeConfig?: ModelConfigs['claude']
    }
    if (!topic || !synthesizer) {
      return res.status(400).json({ error: 'topic and synthesizer are required' })
    }

    const modelConfigs: ModelConfigs = {
      deepseek: deepseekConfig ?? DEFAULT_MODEL_CONFIGS.deepseek,
      claude: claudeConfig ?? DEFAULT_MODEL_CONFIGS.claude,
      chatgpt: {},
    }

    const id = uuid()
    debates.create({
      id, topic, principles, synthesizer,
      deepseekConfigJson: JSON.stringify(modelConfigs.deepseek),
      claudeConfigJson: JSON.stringify(modelConfigs.claude),
    })

    res.json({ id })

    const emit = (event: WSEvent) => {
      const listeners = wsClients.get(id)
      listeners?.forEach(fn => fn(event))
    }

    runDebate(id, topic, principles, synthesizer, cdp, emit, modelConfigs).catch(err => {
      console.error('[debate] fatal error:', err)
      emit({ type: 'error', debateId: id, error: String(err) })
      debates.setStatus(id, 'error')
    })
  })

  // GET /api/debates — list all
  router.get('/debates', (_req, res) => {
    res.json(debates.list())
  })

  // GET /api/debates/:id — detail
  router.get('/debates/:id', (req, res) => {
    const debate = debates.get(req.params.id)
    if (!debate) return res.status(404).json({ error: 'not found' })
    res.json({
      debate,
      messages: messages.listByDebate(req.params.id),
      summary: summaries.get(req.params.id),
    })
  })

  // GET /api/debates/:id/export — Markdown export
  router.get('/debates/:id/export', (req, res) => {
    const debate = debates.get(req.params.id)
    if (!debate) return res.status(404).json({ error: 'not found' })
    const msgs = messages.listByDebate(req.params.id)
    const summary = summaries.get(req.params.id)

    // Phase + model label tables — kept here on purpose; the web mirrors
    // these in lib/phases.ts and lib/models.ts. If these get out of sync
    // the export will just have slightly different labels than the page,
    // not break.
    const PHASE_LABEL: Record<number, { roman: string; name: string }> = {
      2: { roman: 'I',   name: '各自方案' },
      3: { roman: 'II',  name: '匿名互评 + 排名' },
      4: { roman: 'III', name: '作者修订' },
      5: { roman: 'IV',  name: '综合裁决' },
      6: { roman: 'V',   name: '终稿复核' },
    }
    const MODEL_LABEL: Record<string, string> = {
      claude: 'Claude', chatgpt: 'ChatGPT', deepseek: 'DeepSeek',
    }

    // The topic field accepts a pasted markdown document. Use only its
    // first non-empty line (with leading #/list markers stripped) as the
    // H1; the remainder goes into a separate "## 议题原文" section so the
    // export's outline stays clean.
    const topicLines = debate.topic.split('\n')
    const firstNonEmpty = topicLines.findIndex(l => l.trim()) ?? -1
    const firstLine = firstNonEmpty >= 0 ? topicLines[firstNonEmpty].trim() : ''
    const titleLine = firstLine.replace(/^#+\s*/, '').replace(/^[*_>-]+\s*/, '').trim()
    const restLines = firstNonEmpty >= 0 ? topicLines.slice(firstNonEmpty + 1).join('\n').trim() : ''

    const dateStr = new Date(debate.created_at).toLocaleString('zh-CN')

    let md = ''
    md += `# ${titleLine || '（无标题）'}\n\n`
    md += `*综合者 · ${MODEL_LABEL[debate.synthesizer] ?? debate.synthesizer} | ${dateStr}*\n\n`
    if (debate.principles) {
      md += `> **设计原则**：${debate.principles}\n\n`
    }
    if (restLines) {
      md += `## 议题原文\n\n${restLines}\n\n`
    }
    md += `---\n\n`

    let currentPhase = 0
    for (const msg of msgs) {
      if (msg.phase !== currentPhase) {
        currentPhase = msg.phase
        const meta = PHASE_LABEL[currentPhase]
        const header = meta ? `${meta.roman} · ${meta.name}` : `第 ${currentPhase} 阶段`
        md += `## ${header}\n\n`
      }
      md += `### ${MODEL_LABEL[msg.model] ?? msg.model}\n\n${msg.content}\n\n`
    }

    if (summary) {
      md += `## 终稿 · 异同对照 + 关键分歧裁决\n\n${summary.comparison}\n\n`
      md += `## 终稿 · 迭代后的综合方案\n\n${summary.final_proposal}\n\n`
      if (summary.dissent) md += `## 终稿 · 少数派意见\n\n${summary.dissent}\n\n`
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="debate-${debate.id.slice(0, 8)}.md"`)
    res.send(md)
  })

  // DELETE /api/debates/:id — remove debate and all its messages/summary
  router.delete('/debates/:id', (req, res) => {
    const id = req.params.id
    const status = debates.getStatus(id)
    if (!status) return res.status(404).json({ error: 'not found' })
    if (status === 'running' || status === 'pending') {
      return res.status(409).json({ error: '进行中的辩论无法删除' })
    }
    debates.delete(id)
    res.json({ ok: true })
  })

  // POST /api/debates/:id/messages/refetch — recover the LATEST assistant
  // reply from the live model tab and overwrite the stored content. Use
  // when the orchestrator captured an error placeholder (rate limit, JS
  // error) but the model later produced a real reply we want to keep.
  // Body: { phase: 2..6, model: 'claude'|'chatgpt'|'deepseek' }
  router.post('/debates/:id/messages/refetch', async (req, res) => {
    const { phase, model } = req.body as { phase?: DebatePhase; model?: ModelName }
    if (!phase || !model) return res.status(400).json({ error: 'phase and model required' })
    if (!MODELS.includes(model)) return res.status(400).json({ error: 'unknown model' })

    const debate = debates.get(req.params.id)
    if (!debate) return res.status(404).json({ error: 'debate not found' })

    try {
      const page = await cdp.ensurePage(model)
      const adapter = ADAPTER_REGISTRY[model].ctor()
      adapter.setPage(page)
      // Reload first — some sites cache a transient error placeholder that
      // gets replaced by the real reply once the page refreshes (most often
      // ChatGPT's "Unusual activity" notice). Then poll the adapter (which
      // owns the per-site selectors) until at least one assistant message
      // renders, up to 15s.
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
      await adapter.ensureReady()
      const deadline = Date.now() + 15_000
      while (Date.now() < deadline) {
        if (await adapter.hasAssistantMessage()) break
        await new Promise(r => setTimeout(r, 500))
      }
      const content = await adapter.readLastAssistantMessage()
      if (!content.trim()) {
        return res.status(409).json({ error: 'live tab has no assistant message to capture' })
      }

      const updated = messages.updateLatest(req.params.id, phase, model, content)
      if (!updated) return res.status(404).json({ error: 'no prior message row to update' })

      // If we just refetched the synthesizer's Phase 5, re-parse the summary.
      if (phase === 5 && model === debate.synthesizer) {
        const { comparison, finalProposal, dissent } = parsePhase5Output(content)
        summaries.upsert(req.params.id, comparison, finalProposal, dissent)
      }

      res.json({ ok: true, content, length: content.length })
    } catch (err) {
      console.error('[refetch] failed:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  // GET /api/status — browser readiness
  router.get('/status', async (_req, res) => {
    try {
      const loginStatus = await cdp.allLoggedIn()
      res.json({ ready: true, loginStatus })
    } catch (err) {
      res.json({ ready: false, error: String(err) })
    }
  })

  return router
}
