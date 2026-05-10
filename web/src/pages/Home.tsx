import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface DebateRow {
  id: string
  topic: string
  synthesizer: string
  status: string
  created_at: number
  completed_at?: number
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待付印',
  running: '即时印行',
  done: '已成稿',
  error: '终止',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--paper-faint)',
  running: 'var(--vermilion)',
  done: 'var(--paper)',
  error: 'var(--vermilion)',
}

const MODEL_DISPLAY: Record<string, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  deepseek: 'DeepSeek',
}

export default function Home() {
  const [debates, setDebates] = useState<DebateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const confirmIdRef = useRef<string | null>(null)  // synchronous mirror of confirmId for fast double-clicks
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/debates')
      .then(r => r.json())
      .then(d => { setDebates(d); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [])

  const handleDeleteClick = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current)

    // Read from ref — survives fast double-clicks where state hasn't re-rendered yet
    if (confirmIdRef.current !== id) {
      confirmIdRef.current = id
      setConfirmId(id)
      setDeleteError(null)
      // 8s window to confirm — generous enough for real users to read "确认" and decide
      confirmTimeoutRef.current = setTimeout(() => {
        if (confirmIdRef.current === id) {
          confirmIdRef.current = null
          setConfirmId(prev => (prev === id ? null : prev))
        }
      }, 8000)
      return
    }

    // Confirmed
    confirmIdRef.current = null
    try {
      const res = await fetch(`/api/debates/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setDeleteError(err.error ?? '删除失败')
        setConfirmId(null)
        return
      }
      setDebates(prev => prev.filter(d => d.id !== id))
      setConfirmId(null)
    } catch (err) {
      setDeleteError(String(err))
      setConfirmId(null)
    }
  }

  const dateOf = (ts: number) => {
    const d = new Date(ts)
    return {
      day: d.getDate().toString().padStart(2, '0'),
      month: d.toLocaleString('zh-CN', { month: 'long' }),
      year: d.getFullYear(),
      time: d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }
  }

  return (
    <div style={{
      maxWidth: 1100,
      margin: '0 auto',
      padding: '3.2rem 2.4rem 4rem',
    }}>
      {/* Editorial masthead */}
      <header className="fade-up" style={{
        borderBottom: '1.5px solid var(--paper)',
        paddingBottom: '1.6rem',
        marginBottom: '2.6rem',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '2rem',
        flexWrap: 'wrap',
      }}>
        <div>
          <div className="byline" style={{ marginBottom: '0.5rem' }}>
            第 <span style={{ color: 'var(--paper)' }}>{debates.length || '—'}</span> 期 · 三方论辩月报
          </div>
          <h1 className="display" style={{
            fontSize: 'clamp(40px, 5.5vw, 68px)',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: 'var(--paper)',
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.3em',
          }}>
            辩论广场
            <span style={{
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: '0.5em',
              color: 'var(--paper-mute)',
              letterSpacing: 0,
            }}>
              Making Debate
            </span>
          </h1>
          <p style={{
            fontFamily: 'var(--serif-body)',
            fontSize: 16,
            fontStyle: 'italic',
            color: 'var(--paper-mute)',
            marginTop: '0.7rem',
            maxWidth: 540,
            lineHeight: 1.55,
          }}>
            三位 AI 围绕你给的议题各陈己见、相互批评、再综合迭代，最终交出比任何单方更完整的方案。
          </p>
        </div>

        <button className="primary" onClick={() => navigate('/new')}>
          拟订新议题
        </button>
      </header>

      {loading ? (
        <p className="byline faint">载入中…</p>
      ) : debates.length === 0 ? (
        <div className="fade-up" style={{
          textAlign: 'center',
          padding: '5rem 1rem',
        }}>
          <div className="display" style={{
            fontSize: 56,
            fontStyle: 'italic',
            color: 'var(--paper-faint)',
            marginBottom: '1rem',
            fontWeight: 300,
          }}>
            空白页
          </div>
          <p className="byline" style={{ marginBottom: '1.6rem' }}>
            尚无任何论辩记录在档
          </p>
          <button className="primary" onClick={() => navigate('/new')}>
            刊发第一期
          </button>
        </div>
      ) : (
        <div>
          {/* Editorial archive header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '70px 1fr 140px 100px 80px',
            gap: '1.5rem',
            alignItems: 'baseline',
            paddingBottom: '0.7rem',
            borderBottom: '1px solid var(--rule)',
            marginBottom: '0.5rem',
          }}>
            <div className="byline">日期</div>
            <div className="byline">议题</div>
            <div className="byline">综合者</div>
            <div className="byline" style={{ textAlign: 'right' }}>状态</div>
            <div />
          </div>

          {deleteError && (
            <p style={{
              color: 'var(--vermilion)',
              fontFamily: 'var(--serif-body)',
              fontStyle: 'italic',
              fontSize: 13,
              padding: '0.7rem 0',
              borderBottom: '1px solid var(--rule-soft)',
            }}>
              {deleteError}
            </p>
          )}

          {debates.map((d, i) => {
            const dt = dateOf(d.created_at)
            return (
              <article
                key={d.id}
                className="archive-row fade-up"
                onClick={() => navigate(`/debates/${d.id}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 1fr 140px 100px 80px',
                  gap: '1.5rem',
                  alignItems: 'baseline',
                  padding: '1.4rem 0',
                  borderBottom: '1px solid var(--rule-soft)',
                  cursor: 'pointer',
                  transition: 'background 0.18s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--ink-2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                  {/* Date — calendar-style stack */}
                  <div>
                    <div className="display" style={{
                      fontSize: 30,
                      fontWeight: 500,
                      color: 'var(--paper)',
                      lineHeight: 1,
                      fontFeatureSettings: '"onum" 1',
                    }}>
                      {dt.day}
                    </div>
                    <div style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--paper-faint)',
                      marginTop: 4,
                    }}>
                      {dt.month} · {dt.year}
                    </div>
                  </div>

                  {/* Topic */}
                  <div>
                    <h3 className="display" style={{
                      fontSize: 19,
                      fontWeight: 500,
                      color: 'var(--paper)',
                      lineHeight: 1.35,
                      marginBottom: '0.3rem',
                    }}>
                      {d.topic}
                    </h3>
                    <div className="byline faint">
                      第 {String(i + 1).padStart(3, '0')} 卷 · {dt.time}
                    </div>
                  </div>

                  {/* Synthesizer */}
                  <div className="display" style={{
                    fontSize: 15,
                    fontStyle: 'italic',
                    color: 'var(--paper-mute)',
                    fontWeight: 500,
                  }}>
                    {MODEL_DISPLAY[d.synthesizer] ?? d.synthesizer}
                  </div>

                  {/* Status */}
                  <div style={{
                    textAlign: 'right',
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: STATUS_COLOR[d.status] ?? 'var(--paper-mute)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 8,
                  }}>
                    {d.status === 'running' && (
                      <span className="writing-pulse" style={{ background: 'var(--vermilion)' }} />
                    )}
                    {STATUS_LABEL[d.status] ?? d.status}
                  </div>

                  {/* Delete affordance — hidden until row hover, two-step confirm */}
                  <div style={{ textAlign: 'right' }}>
                    {d.status !== 'running' && d.status !== 'pending' && (
                      <button
                        className={`delete-btn ${confirmId === d.id ? 'confirm' : ''}`}
                        onClick={e => handleDeleteClick(e, d.id)}
                      >
                        {confirmId === d.id ? '确认' : '删除'}
                      </button>
                    )}
                  </div>
                </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
