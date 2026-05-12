import { useEffect, useRef, useState } from 'react'

export type ModelName = 'claude' | 'chatgpt' | 'deepseek'
export type DebatePhase = 1 | 2 | 3 | 4

export interface WSEvent {
  type: 'phase_started' | 'delta' | 'message_complete' | 'summary' | 'done' | 'error'
  debateId: string
  phase?: DebatePhase
  model?: ModelName
  content?: string
  error?: string
}

export interface ModelStream {
  phase: DebatePhase
  content: string
  complete: boolean
}

export interface DebateState {
  phase: DebatePhase
  streams: Record<ModelName, ModelStream[]>
  summary: { comparison: string; finalProposal: string } | null
  done: boolean
  error: string | null
}

// Phase 1 is conceptual "开题" with no model output; the first emitted phase
// from the orchestrator is 2 (各自方案).
const INITIAL: DebateState = {
  phase: 2,
  streams: { claude: [], chatgpt: [], deepseek: [] },
  summary: null,
  done: false,
  error: null,
}

export function useDebateSocket(debateId: string | undefined, liveMode: boolean) {
  const [state, setState] = useState<DebateState>(INITIAL)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!debateId || !liveMode) return

    const ws = new WebSocket(`ws://localhost:3001/ws/debates/${debateId}`)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      const event: WSEvent = JSON.parse(ev.data)
      setState(prev => applyEvent(prev, event))
    }

    ws.onerror = () => setState(prev => ({ ...prev, error: 'WebSocket connection error' }))

    return () => ws.close()
  }, [debateId, liveMode])

  return state
}

function applyEvent(prev: DebateState, ev: WSEvent): DebateState {
  switch (ev.type) {
    case 'phase_started': {
      const phase = ev.phase ?? prev.phase
      return { ...prev, phase }
    }
    case 'delta': {
      if (!ev.model || !ev.phase) return prev
      const modelStreams = [...(prev.streams[ev.model] ?? [])]
      const lastIdx = modelStreams.findLastIndex((s: ModelStream) => s.phase === ev.phase)
      if (lastIdx >= 0) {
        modelStreams[lastIdx] = {
          ...modelStreams[lastIdx],
          content: modelStreams[lastIdx].content + (ev.content ?? ''),
        }
      } else {
        modelStreams.push({ phase: ev.phase!, content: ev.content ?? '', complete: false })
      }
      return {
        ...prev,
        streams: { ...prev.streams, [ev.model]: modelStreams },
      }
    }
    case 'message_complete': {
      if (!ev.model || !ev.phase) return prev
      const modelStreams = [...(prev.streams[ev.model] ?? [])]
      const lastIdx = modelStreams.findLastIndex((s: ModelStream) => s.phase === ev.phase)
      // Replace content with the authoritative final markdown — heals any
      // streaming drift from non-monotonic intermediate snapshots.
      const finalContent = ev.content ?? modelStreams[lastIdx]?.content ?? ''
      if (lastIdx >= 0) {
        modelStreams[lastIdx] = { ...modelStreams[lastIdx], content: finalContent, complete: true }
      } else {
        modelStreams.push({ phase: ev.phase!, content: finalContent, complete: true })
      }
      return { ...prev, streams: { ...prev.streams, [ev.model]: modelStreams } }
    }
    case 'summary': {
      try {
        const summary = JSON.parse(ev.content ?? '{}')
        return { ...prev, summary }
      } catch { return prev }
    }
    case 'done':
      return { ...prev, done: true }
    case 'error':
      return { ...prev, error: ev.error ?? 'Unknown error' }
    default:
      return prev
  }
}
