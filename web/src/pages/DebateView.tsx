import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import PhaseIndicator from '../components/PhaseIndicator.tsx'
import ColumnStream from '../components/ColumnStream.tsx'
import SummaryPanel from '../components/SummaryPanel.tsx'
import { useDebateSocket, ModelName, ModelStream } from '../hooks/useDebateSocket.ts'

const MODELS: ModelName[] = ['claude', 'chatgpt', 'deepseek']

interface StoredMessage {
  phase: number
  model: ModelName
  content: string
}

interface StoredSummary {
  comparison: string
  final_proposal: string
}

export default function DebateView() {
  const { id } = useParams<{ id: string }>()
  const [debate, setDebate] = useState<any>(null)
  const [liveMode, setLiveMode] = useState(false)
  const [staticStreams, setStaticStreams] = useState<Record<ModelName, ModelStream[]>>({
    claude: [], chatgpt: [], deepseek: [],
  })
  const [staticSummary, setStaticSummary] = useState<{ comparison: string; finalProposal: string } | null>(null)

  const liveState = useDebateSocket(id, liveMode)

  useEffect(() => {
    if (!id) return
    fetch(`/api/debates/${id}`)
      .then(r => r.json())
      .then((data: { debate: any; messages: StoredMessage[]; summary?: StoredSummary }) => {
        setDebate(data.debate)
        const isActive = data.debate.status === 'pending' || data.debate.status === 'running'
        setLiveMode(isActive)

        if (!isActive) {
          // build streams from DB
          const streams: Record<ModelName, ModelStream[]> = { claude: [], chatgpt: [], deepseek: [] }
          for (const msg of data.messages) {
            if (!streams[msg.model]) streams[msg.model] = []
            streams[msg.model].push({ phase: msg.phase as any, content: msg.content, complete: true })
          }
          setStaticStreams(streams)
          if (data.summary) {
            setStaticSummary({ comparison: data.summary.comparison, finalProposal: data.summary.final_proposal })
          }
        }
      })
      .catch(console.error)
  }, [id])

  const streams = liveMode ? liveState.streams : staticStreams
  const phase = liveMode ? liveState.phase : 4
  const done = liveMode ? liveState.done : debate?.status === 'done'
  const summary = liveMode ? liveState.summary : staticSummary
  const error = liveMode ? liveState.error : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: 13 }}>← 返回</Link>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {debate?.topic ?? '加载中...'}
          </h2>
          {done && (
            <span style={{ fontSize: 12, color: 'var(--chatgpt)', fontWeight: 600 }}>辩论完成</span>
          )}
          {liveMode && !done && (
            <span style={{ fontSize: 12, color: 'var(--deepseek)', fontWeight: 600 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--deepseek)', marginRight: 5 }} />
              进行中
            </span>
          )}
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: '0.5rem' }}>
            错误：{error}
          </div>
        )}

        <PhaseIndicator current={phase} done={done} />
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: '1rem', flex: 1, minHeight: 0,
        ...(summary ? { maxHeight: 'calc(100vh - 320px)' } : { maxHeight: 'calc(100vh - 160px)' }),
      }}>
        {MODELS.map(model => (
          <ColumnStream
            key={model}
            model={model}
            streams={streams[model] ?? []}
            isActive={liveMode && !done}
          />
        ))}
      </div>

      {summary && (
        <SummaryPanel
          comparison={summary.comparison}
          finalProposal={summary.finalProposal}
          debateId={id!}
        />
      )}
    </div>
  )
}
