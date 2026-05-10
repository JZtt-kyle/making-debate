import { CDPSession } from '../browser/cdp.js'
import { ClaudeAdapter } from '../browser/adapters/claude.js'
import { ChatGPTAdapter } from '../browser/adapters/chatgpt.js'
import { DeepSeekAdapter } from '../browser/adapters/deepseek.js'
import { SiteAdapter } from '../browser/adapters/base.js'
import { ModelName, PHASE1_PROMPT, PHASE3_PROMPT, PHASE4_PROMPT } from './prompts.js'
import { db } from '../storage/db.js'

export type DebatePhase = 1 | 2 | 3 | 4
export type DebateStatus = 'pending' | 'running' | 'done' | 'error'

export interface WSEvent {
  type: 'phase_started' | 'delta' | 'message_complete' | 'summary' | 'done' | 'error'
  debateId: string
  phase?: DebatePhase
  model?: ModelName
  content?: string
  error?: string
}

type EventEmitter = (event: WSEvent) => void

const MODELS: ModelName[] = ['claude', 'chatgpt', 'deepseek']

function makeAdapters(): Record<ModelName, SiteAdapter> {
  return {
    claude: new ClaudeAdapter(),
    chatgpt: new ChatGPTAdapter(),
    deepseek: new DeepSeekAdapter(),
  }
}

async function runModel(
  debateId: string,
  phase: DebatePhase,
  model: ModelName,
  adapter: SiteAdapter,
  prompt: string,
  emit: EventEmitter
): Promise<string> {
  emit({ type: 'phase_started', debateId, phase, model })
  try {
    await adapter.newConversation()
    await adapter.sendMessage(prompt)
    const content = await adapter.streamResponse(delta => {
      emit({ type: 'delta', debateId, phase, model, content: delta })
    })
    emit({ type: 'message_complete', debateId, phase, model, content })
    db.prepare(
      'INSERT INTO messages (debate_id, phase, model, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(debateId, phase, model, content, Date.now())
    return content
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(`[debate] ${model} phase ${phase} failed:`, error)
    emit({ type: 'error', debateId, phase, model, error })
    db.prepare(
      'INSERT INTO messages (debate_id, phase, model, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(debateId, phase, model, `[ERROR: ${error}]`, Date.now())
    return ''
  }
}

export async function runDebate(
  debateId: string,
  topic: string,
  principles: string,
  synthesizer: ModelName,
  cdp: CDPSession,
  emit: EventEmitter
): Promise<void> {
  db.prepare("UPDATE debates SET status = 'running' WHERE id = ?").run(debateId)

  const adapters = makeAdapters()

  // wire each adapter to its page
  for (const model of MODELS) {
    const page = await cdp.ensurePage(model as 'claude' | 'chatgpt' | 'deepseek')
    adapters[model].setPage(page)
    await adapters[model].ensureReady()
  }

  // Phase 1+2: open + initial proposals (same prompt, one message)
  const phase2Results: { name: ModelName; content: string }[] = []
  const phase1Jobs = MODELS.map(async model => {
    const prompt = PHASE1_PROMPT(topic, principles, model)
    const content = await runModel(debateId, 2, model, adapters[model], prompt, (ev) => {
      // report as phase 1 for phase_started, then phase 2 for deltas
      emit({ ...ev, phase: ev.type === 'phase_started' ? 1 : 2 })
    })
    phase2Results.push({ name: model, content })
  })
  await Promise.all(phase1Jobs)

  // Phase 3: mutual critique
  const phase3Results: { name: ModelName; content: string }[] = []
  const phase3Jobs = MODELS.map(async model => {
    const prompt = PHASE3_PROMPT(model, phase2Results)
    const content = await runModel(debateId, 3, model, adapters[model], prompt, emit)
    phase3Results.push({ name: model, content })
  })
  await Promise.all(phase3Jobs)

  // Phase 4: synthesis by designated model
  const synthAdapter = adapters[synthesizer]
  const synthPrompt = PHASE4_PROMPT(synthesizer, phase2Results, phase3Results)
  const summaryContent = await runModel(debateId, 4, synthesizer, synthAdapter, synthPrompt, emit)

  // parse out the two sections for the summary table
  const comparisonMatch = summaryContent.match(/##\s*一[、,，]观点异同对照([\s\S]*?)##\s*二[、,，]/i)
  const proposalMatch = summaryContent.match(/##\s*二[、,，]迭代后的综合方案([\s\S]*?)$/i)
  const comparison = comparisonMatch?.[1]?.trim() ?? summaryContent
  const finalProposal = proposalMatch?.[1]?.trim() ?? ''

  db.prepare(
    'INSERT OR REPLACE INTO summaries (debate_id, comparison, final_proposal) VALUES (?, ?, ?)'
  ).run(debateId, comparison, finalProposal)

  emit({ type: 'summary', debateId, content: JSON.stringify({ comparison, finalProposal }) })

  db.prepare("UPDATE debates SET status = 'done', completed_at = ? WHERE id = ?").run(Date.now(), debateId)
  emit({ type: 'done', debateId })
}
