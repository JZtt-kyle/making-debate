import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import PhaseIndicator from '../components/PhaseIndicator.tsx'
import PhaseSection, { PHASE_DISPLAY } from '../components/PhaseSection.tsx'
import { useDebateSocket, ModelName, ModelStream, DebatePhase } from '../hooks/useDebateSocket.ts'

const MODELS: ModelName[] = ['claude', 'chatgpt', 'deepseek']
const CONTENT_PHASES: DebatePhase[] = [2, 3, 4]

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

type ByPhase = Record<DebatePhase, Partial<Record<ModelName, ModelStream | null>>>

function transposeByPhase(
  streams: Record<ModelName, ModelStream[]>
): ByPhase {
  const out: ByPhase = { 1: {}, 2: {}, 3: {}, 4: {} }
  for (const model of MODELS) {
    for (const s of streams[model] ?? []) {
      out[s.phase][model] = s
    }
  }
  return out
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
          streams[msg.model].push({ phase: msg.phase as DebatePhase, content: msg.content, complete: true })
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

  const byPhase = useMemo(() => transposeByPhase(streams), [streams])

  // Highest stored phase = highest db phase that has any model output
  const highestStoredPhase = (Object.values(staticStreams).flat()
    .reduce<number>((m, s) => Math.max(m, s.phase), 2)) as DebatePhase
  const aborted = !liveMode && debate?.status === 'error'
  // For aborted: the "current" (i.e., not-yet-completed) phase is highestStored + 1
  const currentPhase: DebatePhase = liveMode ? liveState.phase
                    : aborted   ? (Math.min(highestStoredPhase + 1, 4) as DebatePhase)
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
  const synthesizer = debate?.synthesizer as ModelName | undefined

  const exportMd = () => {
    if (id) window.open(`/api/debates/${id}/export`, '_blank')
  }

  // Should we render each section?
  // - Phase 2/3: always render (even if empty, to show structure)
  // - Phase 4 (synthesis): only if synthesizer message exists OR debate reached phase 4
  const phase4HasContent = synthesizer ? !!byPhase[4][synthesizer]?.content : false
  const showPhase4 = phase4HasContent || currentPhase === 4 || done || !!summary
  const phaseSectionsToShow: DebatePhase[] = CONTENT_PHASES.filter(p =>
    p !== 4 || showPhase4
  )

  // Sticky in-page nav: jump to a phase's section
  const scrollToPhase = (p: DebatePhase) => {
    document.getElementById(`phase-${p}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{
      maxWidth: 1480,
      margin: '0 auto',
      padding: '2rem 2.4rem 4rem',
      display: 'grid',
      gridTemplateColumns: '160px 1fr',
      gap: '2.2rem',
    }}>
      {/* Sticky left rail: phase navigator */}
      <aside style={{
        position: 'sticky',
        top: '2rem',
        alignSelf: 'start',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        paddingTop: '0.4rem',
      }}>
        <Link to="/" className="byline" style={{
          borderBottom: 'none',
          color: 'var(--paper-mute)',
        }}>
          ← 回到广场
        </Link>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.6rem' }}>
          {CONTENT_PHASES.map(p => {
            const d = PHASE_DISPLAY[p]
            const isCurrent = p === currentPhase && !done
            const isDone = p < currentPhase || done
            const tone = isCurrent ? 'var(--vermilion)' : isDone ? 'var(--paper)' : 'var(--paper-faint)'
            return (
              <button
                key={p}
                onClick={() => scrollToPhase(p)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0.35rem 0',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.55rem',
                  cursor: 'pointer',
                  color: tone,
                  borderLeft: `2px solid ${isCurrent ? 'var(--vermilion)' : 'transparent'}`,
                  paddingLeft: '0.55rem',
                  borderRadius: 0,
                  fontFamily: 'var(--serif-display)',
                  letterSpacing: 0,
                  textTransform: 'none',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  fontStyle: 'italic',
                  fontSize: 16,
                  fontFeatureSettings: '"onum" 1',
                  color: tone,
                }}>
                  {d.roman}
                </span>
                <span style={{
                  fontSize: 13,
                  color: tone,
                }}>
                  {d.label}
                </span>
              </button>
            )
          })}
        </nav>

        {(done || summary) && (
          <button
            onClick={exportMd}
            className="ghost"
            style={{ marginTop: '1.6rem' }}
          >
            导出 MD
          </button>
        )}
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Editorial masthead */}
        <header className="fade-up">
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: '0.7rem',
          }}>
            <span className="byline" style={{
              color: 'var(--paper-mute)',
            }}>
              三方论辩 · 第 {debate?.id?.slice(0, 6) ?? '------'} 期
            </span>
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
            <span>{date}</span>
            {synthesizer && (
              <span>综合者 · <em style={{
                fontStyle: 'italic',
                color: 'var(--paper)',
                fontFamily: 'var(--serif-display)',
                textTransform: 'none',
                letterSpacing: 0,
                fontSize: 14,
              }}>{synthesizer}</em></span>
            )}
          </div>

          {debate?.principles && (
            <p style={{
              fontFamily: 'var(--serif-body)',
              fontStyle: 'italic',
              fontSize: 15,
              color: 'var(--paper-mute)',
              borderLeft: '2px solid var(--rule)',
              paddingLeft: '0.9rem',
              marginBottom: '1.2rem',
              maxWidth: '85%',
            }}>
              {debate.principles}
            </p>
          )}

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

          <PhaseIndicator current={currentPhase} done={done} aborted={aborted} />
        </header>

        {/* Phase sections — each is a "幕" with its own three-column matrix */}
        <main style={{ marginTop: '1.8rem', display: 'flex', flexDirection: 'column' }}>
          {phaseSectionsToShow.map(p => {
            const isActive = liveMode && p === currentPhase && !done
            const isAbortedHere = aborted && p === currentPhase
            // Phase 4 = single-column (synthesizer only) + inline summary
            if (p === 4) {
              return (
                <PhaseSection
                  key={p}
                  phase={4}
                  panels={byPhase[4]}
                  isActivePhase={isActive}
                  isAborted={isAbortedHere}
                  singleColumn={synthesizer}
                >
                  {summary && (
                    <SummarySection comparison={summary.comparison}
                                    finalProposal={summary.finalProposal} />
                  )}
                </PhaseSection>
              )
            }
            return (
              <PhaseSection
                key={p}
                phase={p}
                panels={byPhase[p]}
                isActivePhase={isActive}
                isAborted={isAbortedHere}
              />
            )
          })}
        </main>
      </div>
    </div>
  )
}

// Inline summary rendered inside the Phase IV section.
// Two tabs: 异同对照 / 综合方案 (replaces the old footer SummaryPanel).
function SummarySection({ comparison, finalProposal }:
  { comparison: string; finalProposal: string }) {
  const [tab, setTab] = useState<'comparison' | 'proposal'>('comparison')
  const content = tab === 'comparison' ? comparison : finalProposal

  const TABS = [
    { id: 'comparison' as const, roman: 'a', label: '异同对照' },
    { id: 'proposal'   as const, roman: 'b', label: '综合方案' },
  ]

  return (
    <section style={{
      marginTop: '1.4rem',
      paddingTop: '1.2rem',
      borderTop: '1px dashed var(--rule)',
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '1.4rem',
        flexWrap: 'wrap',
        marginBottom: '1rem',
      }}>
        <div className="byline" style={{ color: 'var(--paper-mute)' }}>
          编后记 · 终稿
        </div>

        <nav style={{
          display: 'flex',
          gap: '1.4rem',
          marginLeft: 'auto',
          alignItems: 'center',
        }}>
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0.3rem 0',
                  borderBottom: `1.5px solid ${active ? 'var(--vermilion)' : 'transparent'}`,
                  borderRadius: 0,
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  color: active ? 'var(--paper)' : 'var(--paper-mute)',
                  fontFamily: 'var(--serif-display)',
                  fontWeight: active ? 600 : 500,
                  fontSize: 14,
                  letterSpacing: 0,
                  textTransform: 'none',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </header>

      <div className="prose fade-up" key={tab}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </section>
  )
}
