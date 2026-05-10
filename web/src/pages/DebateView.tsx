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

const STATUS_LABEL: Record<string, string> = {
  pending: '排版中',
  running: '即时印行',
  done: '已成稿',
  error: '终止付印',
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

        const streams: Record<ModelName, ModelStream[]> = { claude: [], chatgpt: [], deepseek: [] }
        for (const msg of data.messages) {
          if (!streams[msg.model]) streams[msg.model] = []
          streams[msg.model].push({ phase: msg.phase as any, content: msg.content, complete: true })
        }
        setStaticStreams(streams)
        if (data.summary) {
          setStaticSummary({ comparison: data.summary.comparison, finalProposal: data.summary.final_proposal })
        }
      })
      .catch(console.error)
  }, [id])

  const streams: Record<ModelName, ModelStream[]> = liveMode
    ? Object.fromEntries(MODELS.map(m => {
        const stat = staticStreams[m] ?? []
        const live = liveState.streams[m] ?? []
        const merged = [...stat]
        for (const ls of live) {
          const i = merged.findIndex(s => s.phase === ls.phase)
          if (i >= 0) merged[i] = ls
          else merged.push(ls)
        }
        merged.sort((a, b) => a.phase - b.phase)
        return [m, merged]
      })) as Record<ModelName, ModelStream[]>
    : staticStreams
  // Highest phase that actually ran (has stored messages). Used so an aborted
  // debate shows the indicator stopped at the right phase, not pretending Phase IV.
  const highestStoredPhase = (Object.values(staticStreams).flat()
    .reduce((m, s) => Math.max(m, s.phase), 1)) as 1 | 2 | 3 | 4
  const aborted = !liveMode && debate?.status === 'error'
  // For aborted: "current" = phase that didn't get to run = highestStored + 1 (capped at 4)
  const phase = liveMode ? liveState.phase
              : aborted   ? (Math.min(highestStoredPhase + 1, 4) as 1 | 2 | 3 | 4)
                          : 4
  const done = liveMode ? liveState.done : debate?.status === 'done'
  const summary = liveMode ? (liveState.summary ?? staticSummary) : staticSummary
  const wsError = liveMode ? liveState.error : null
  const dbError = debate?.status === 'error' ? '辩论异常终止 · 服务器进程中断' : null
  const error = wsError ?? dbError

  const status = debate?.status ?? 'pending'
  const date = debate?.created_at
    ? new Date(debate.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div style={{
      maxWidth: 1480,
      margin: '0 auto',
      padding: '2rem 2.4rem 1.4rem',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
    }}>
      {/* Editorial masthead */}
      <header className="fade-up" style={{ flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '0.7rem',
        }}>
          <Link to="/" className="byline" style={{
            borderBottom: 'none',
            color: 'var(--paper-mute)',
          }}>
            ← 回到广场
          </Link>
          <span className="byline" style={{
            color: status === 'running' ? 'var(--vermilion)' :
                   status === 'done'    ? 'var(--paper)' :
                   status === 'error'   ? 'var(--vermilion)' :
                                          'var(--paper-faint)',
          }}>
            {status === 'running' && <span className="writing-pulse" style={{
              background: 'var(--vermilion)', marginRight: 8,
            }} />}
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>

        <h1 className="display fade-up" style={{
          fontSize: 'clamp(28px, 3.4vw, 44px)',
          fontWeight: 500,
          color: 'var(--paper)',
          marginBottom: '0.6rem',
          lineHeight: 1.1,
          maxWidth: '85%',
        }}>
          {debate?.topic ?? '加载中…'}
        </h1>

        <div className="byline" style={{
          color: 'var(--paper-mute)',
          marginBottom: '1.2rem',
          display: 'flex',
          gap: '1.6rem',
          flexWrap: 'wrap',
        }}>
          <span>三方论辩</span>
          <span>{date}</span>
          {debate?.synthesizer && (
            <span>综合者 · <em style={{ fontStyle: 'italic', color: 'var(--paper)', fontFamily: 'var(--serif-display)', textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>{debate.synthesizer}</em></span>
          )}
        </div>

        {error && (
          <div style={{
            color: 'var(--vermilion)',
            fontSize: 13,
            fontStyle: 'italic',
            fontFamily: 'var(--serif-body)',
            marginBottom: '0.9rem',
            paddingLeft: '0.7rem',
            borderLeft: '2px solid var(--vermilion)',
          }}>
            {error}
          </div>
        )}

        <PhaseIndicator current={phase} done={done} aborted={aborted} />
      </header>

      {/* Three columns */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '0',
        flex: 1,
        minHeight: 0,
        marginTop: '1.4rem',
        ...(summary ? { maxHeight: 'calc(100vh - 480px)' } : {}),
      }}>
        {MODELS.map(model => (
          <ColumnStream
            key={model}
            model={model}
            streams={streams[model] ?? []}
            isActive={liveMode && !done}
          />
        ))}
      </main>

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
