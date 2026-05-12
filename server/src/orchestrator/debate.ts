import { CDPSession } from '../browser/cdp.js'
import type { SiteAdapter, ModelConfig } from '../browser/adapters/base.js'
import { MODELS, makeAdapters, DEFAULT_MODEL_CONFIGS } from '../browser/adapters/index.js'
import type { ModelName, ModelConfigs } from '../browser/adapters/index.js'
import {
  PHASE1_PROMPT, PHASE3_PROMPT, PHASE4_PROMPT,
  anonymizeProposals, parseRanking, aggregateRankings, parsePhase4Output,
} from './prompts.js'
import type { AnonLabel } from './prompts.js'
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

async function runModel(
  debateId: string,
  phase: DebatePhase,
  model: ModelName,
  adapter: SiteAdapter,
  prompt: string,
  emit: EventEmitter,
  startNew = true,
  config?: ModelConfig
): Promise<string> {
  emit({ type: 'phase_started', debateId, phase, model })
  try {
    if (startNew) {
      await adapter.newConversation()
      if (config && adapter.configure) {
        await adapter.configure(config)
      }
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

  // wire each adapter to its page
  for (const model of MODELS) {
    const page = await cdp.ensurePage(model)
    adapters[model].setPage(page)
    await adapters[model].ensureReady()
  }

  // Phase 2: initial proposals — newConversation + configure called once per model.
  // (Phase 1 is conceptual "开题"; it has no model output, so we don't emit it.)
  const phase2Results: { name: ModelName; content: string }[] = []
  const phase2Jobs = MODELS.map(async model => {
    const prompt = PHASE1_PROMPT(topic, principles, model)
    const content = await runModel(debateId, 2, model, adapters[model], prompt, emit,
      true, modelConfigs[model])
    phase2Results.push({ name: model, content })
  })
  await Promise.all(phase2Jobs)

  // Phase 3: anonymized mutual critique + structured FINAL RANKING
  // (continues same session — no configure needed)
  const anonymized = anonymizeProposals(phase2Results)
  const phase3Results: { name: ModelName; content: string; ranking: AnonLabel[] | null }[] = []
  const phase3Jobs = MODELS.map(async model => {
    const prompt = PHASE3_PROMPT(anonymized)
    const content = await runModel(debateId, 3, model, adapters[model], prompt, emit, false)
    const ranking = parseRanking(content)
    phase3Results.push({ name: model, content, ranking })
    if (ranking) {
      console.log(`[debate] ${model} ranking:`, ranking.map(l => `方案${l}`).join(' > '))
    } else {
      console.warn(`[debate] ${model} did not produce a parseable FINAL RANKING`)
    }
  })
  await Promise.all(phase3Jobs)

  const aggregated = aggregateRankings(anonymized, phase3Results.map(r => r.ranking))
  console.log('[debate] aggregated ranking:',
    aggregated.map(a => `${a.originalName}(${a.label})=${a.avgRank.toFixed(2)}`).join(', '))

  // Phase 4: synthesis by designated model (continues its conversation)
  const synthAdapter = adapters[synthesizer]
  const synthPrompt = PHASE4_PROMPT(synthesizer, phase2Results,
    phase3Results.map(r => ({ name: r.name, content: r.content })), aggregated)
  const summaryContent = await runModel(debateId, 4, synthesizer, synthAdapter, synthPrompt, emit, false)

  const { comparison, finalProposal } = parsePhase4Output(summaryContent)
  summaries.upsert(debateId, comparison, finalProposal)

  emit({ type: 'summary', debateId, content: JSON.stringify({ comparison, finalProposal }) })

  debates.markDone(debateId)
  emit({ type: 'done', debateId })
}
