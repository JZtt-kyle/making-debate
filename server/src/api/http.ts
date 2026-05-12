import express, { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { runDebate, DEFAULT_MODEL_CONFIGS } from '../orchestrator/debate.js'
import type { WSEvent, ModelConfigs } from '../orchestrator/debate.js'
import { CDPSession } from '../browser/cdp.js'
import type { ModelName } from '../browser/adapters/index.js'
import { debates, messages, summaries } from '../storage/repository.js'

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

    const phaseNames: Record<number, string> = {
      1: '开题',
      2: '初步方案',
      3: '互相批评',
      4: '综合迭代',
    }

    let md = `# ${debate.topic}\n\n`
    if (debate.principles) md += `**设计原则**：${debate.principles}\n\n`
    md += `综合者：${debate.synthesizer}｜时间：${new Date(debate.created_at).toLocaleString('zh-CN')}\n\n---\n\n`

    let currentPhase = 0
    for (const msg of msgs) {
      if (msg.phase !== currentPhase) {
        currentPhase = msg.phase
        md += `## 第 ${currentPhase} 阶段：${phaseNames[currentPhase] ?? currentPhase}\n\n`
      }
      md += `### ${msg.model}\n\n${msg.content}\n\n`
    }

    if (summary) {
      md += `## 异同点对照\n\n${summary.comparison}\n\n`
      md += `## 最终综合方案\n\n${summary.final_proposal}\n\n`
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
