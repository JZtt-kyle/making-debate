import { CDPSession } from '../browser/cdp.js'
import type { SiteAdapter, ModelConfig } from '../browser/adapters/base.js'
import { MODELS, makeAdapters, DEFAULT_MODEL_CONFIGS } from '../browser/adapters/index.js'
import type { ModelName, ModelConfigs } from '../browser/adapters/index.js'
import {
  PHASE2_PROMPT, PHASE3_PROMPT, PHASE4_PROMPT, PHASE5_PROMPT, PHASE6_PROMPT,
} from './prompts.js'
import {
  anonymizeProposals, aggregateRankings,
} from './anon.js'
import type { AnonLabel } from './anon.js'
import {
  parseRanking, parsePhase5Output, parseVerdict,
} from './parsers.js'
import { debates, messages, summaries } from '../storage/repository.js'
import type { DebatePhase, DebateStatus } from '../storage/repository.js'

export { DEFAULT_MODEL_CONFIGS }
export type { DebatePhase, DebateStatus, ModelConfigs }

export interface WSEvent {
  type: 'phase_started' | 'delta' | 'message_complete' | 'summary' | 'done' | 'error'
  debateId: string
  phase?: DebatePhase
  model?: ModelName
  content?: string
  error?: string
}

type EventEmitter = (event: WSEvent) => void

// Drive one (phase, model) cell of the debate.
// Every call starts a FRESH conversation — true anonymity for Phase 3, and
// clean isolation between authoring/critiquing/revising/reviewing roles.
async function runModel(
  debateId: string,
  phase: DebatePhase,
  model: ModelName,
  adapter: SiteAdapter,
  prompt: string,
  emit: EventEmitter,
  config?: ModelConfig
): Promise<string> {
  emit({ type: 'phase_started', debateId, phase, model })
  try {
    await adapter.newConversation()
    if (config && adapter.configure) {
      await adapter.configure(config)
    }
    await adapter.sendMessage(prompt)
    const content = await adapter.streamResponse(delta => {
      emit({ type: 'delta', debateId, phase, model, content: delta })
    })
    emit({ type: 'message_complete', debateId, phase, model, content })
    messages.insert(debateId, phase, model, content)
    return content
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(`[debate] ${model} phase ${phase} failed:`, error)
    emit({ type: 'error', debateId, phase, model, error })
    messages.insert(debateId, phase, model, `[ERROR: ${error}]`)
    return ''
  }
}

export async function runDebate(
  debateId: string,
  topic: string,
  principles: string,
  synthesizer: ModelName,
  cdp: CDPSession,
  emit: EventEmitter,
  modelConfigs: ModelConfigs = DEFAULT_MODEL_CONFIGS
): Promise<void> {
  debates.setStatus(debateId, 'running')

  const adapters = makeAdapters()

  for (const model of MODELS) {
    const page = await cdp.ensurePage(model)
    adapters[model].setPage(page)
    await adapters[model].ensureReady()
  }

  // -------------------------------------------------------------------------
  // Phase 2 — 各自方案 (parallel, fresh conversation per model)
  // -------------------------------------------------------------------------
  const phase2Results: { name: ModelName; content: string }[] = []
  await Promise.all(MODELS.map(async model => {
    const prompt = PHASE2_PROMPT(topic, principles, model)
    const content = await runModel(
      debateId, 2, model, adapters[model], prompt, emit, modelConfigs[model])
    phase2Results.push({ name: model, content })
  }))
  // Re-sort to MODELS order (parallel resolves out-of-order)
  phase2Results.sort((a, b) => MODELS.indexOf(a.name) - MODELS.indexOf(b.name))

  // -------------------------------------------------------------------------
  // Phase 3 — 匿名互评 + 排名 (parallel, fresh conversation = TRUE anonymity)
  // The evaluator no longer has its own Phase 2 thread in context.
  // -------------------------------------------------------------------------
  const anonymized = anonymizeProposals(phase2Results)
  const phase3Results: { name: ModelName; content: string; ranking: AnonLabel[] | null }[] = []
  await Promise.all(MODELS.map(async model => {
    const prompt = PHASE3_PROMPT(anonymized)
    const content = await runModel(
      debateId, 3, model, adapters[model], prompt, emit, modelConfigs[model])
    const ranking = parseRanking(content)
    phase3Results.push({ name: model, content, ranking })
    if (ranking) {
      console.log(`[debate] ${model} ranking:`, ranking.map(l => `方案${l}`).join(' > '))
    } else {
      console.warn(`[debate] ${model} did not produce a parseable FINAL RANKING`)
    }
  }))
  phase3Results.sort((a, b) => MODELS.indexOf(a.name) - MODELS.indexOf(b.name))

  const aggregated = aggregateRankings(anonymized, phase3Results.map(r => r.ranking))
  console.log('[debate] aggregated ranking:',
    aggregated.map(a => `${a.originalName}(${a.label})=${a.avgRank.toFixed(2)}`).join(', '))

  // -------------------------------------------------------------------------
  // Phase 4 — 作者修订 (NEW: parallel, fresh conversation)
  // Each author sees its own original + ALL critiques + its anonymous label
  // (so it knows which critiques target it). This is where real iteration
  // happens — currently the system's biggest gap before this change.
  // -------------------------------------------------------------------------
  const labelByName: Record<ModelName, AnonLabel> = Object.fromEntries(
    anonymized.map(a => [a.originalName, a.label])
  ) as Record<ModelName, AnonLabel>

  const phase4Results: { name: ModelName; content: string }[] = []
  await Promise.all(MODELS.map(async model => {
    const myLabel = labelByName[model]
    const myOriginal = phase2Results.find(p => p.name === model)?.content ?? ''
    const allCritiques = phase3Results.map(r => ({ reviewer: r.name, content: r.content }))
    const prompt = PHASE4_PROMPT(model, myLabel, myOriginal, allCritiques, aggregated)
    const content = await runModel(
      debateId, 4, model, adapters[model], prompt, emit, modelConfigs[model])
    phase4Results.push({ name: model, content })
  }))
  phase4Results.sort((a, b) => MODELS.indexOf(a.name) - MODELS.indexOf(b.name))

  // -------------------------------------------------------------------------
  // Phase 5 — 综合 + 裁决 + 少数派意见 (single, synthesizer only)
  // Operates on the REVISED proposals (not the originals), plus the critique
  // record, plus the ranking. Outputs four sections; parser splits them.
  // -------------------------------------------------------------------------
  const synthAdapter = adapters[synthesizer]
  const synthPrompt = PHASE5_PROMPT(
    synthesizer, topic, principles,
    phase4Results,
    phase3Results.map(r => ({ reviewer: r.name, content: r.content })),
    aggregated,
  )
  const summaryContent = await runModel(
    debateId, 5, synthesizer, synthAdapter, synthPrompt, emit, modelConfigs[synthesizer])

  const { comparison, finalProposal, dissent } = parsePhase5Output(summaryContent)
  summaries.upsert(debateId, comparison, finalProposal, dissent)
  emit({ type: 'summary', debateId, content: JSON.stringify({ comparison, finalProposal, dissent }) })

  // -------------------------------------------------------------------------
  // Phase 6 — 终稿复核 (NEW: parallel ratify/veto by non-synthesizers)
  // Lightweight check on the synthesis. Synthesizer doesn't review own work.
  // -------------------------------------------------------------------------
  const reviewers = MODELS.filter(m => m !== synthesizer)
  await Promise.all(reviewers.map(async model => {
    const prompt = PHASE6_PROMPT(model, synthesizer, comparison, finalProposal, dissent)
    const content = await runModel(
      debateId, 6, model, adapters[model], prompt, emit, modelConfigs[model])
    const { verdict, reason } = parseVerdict(content)
    console.log(`[debate] ${model} verdict: ${verdict}${reason ? ` — ${reason}` : ''}`)
  }))

  debates.markDone(debateId)
  emit({ type: 'done', debateId })
}
