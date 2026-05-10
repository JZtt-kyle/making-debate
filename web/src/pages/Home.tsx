import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

interface DebateRow {
  id: string
  topic: string
  synthesizer: string
  status: string
  created_at: number
  completed_at?: number
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--text-muted)',
  running: 'var(--deepseek)',
  done: 'var(--chatgpt)',
  error: 'var(--danger)',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '等待中',
  running: '进行中',
  done: '已完成',
  error: '出错',
}

export default function Home() {
  const [debates, setDebates] = useState<DebateRow[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/debates')
      .then(r => r.json())
      .then(setDebates)
      .catch(console.error)
  }, [])

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 4 }}>Making Debate</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>让三个 AI 围绕你的方案展开辩论，迭代出更好的答案</p>
        </div>
        <button style={{ marginLeft: 'auto' }} onClick={() => navigate('/new')}>
          + 新建辩论
        </button>
      </div>

      {debates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 40, marginBottom: '0.5rem' }}>🗣</p>
          <p>还没有任何辩论记录</p>
          <button style={{ marginTop: '1rem' }} onClick={() => navigate('/new')}>开始第一场辩论</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {debates.map(d => (
            <Link key={d.id} to={`/debates/${d.id}`}>
              <div className="card" style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.topic}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    综合者：{d.synthesizer} ｜ {new Date(d.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: STATUS_COLOR[d.status] ?? 'var(--text-muted)',
                  background: 'var(--surface2)',
                  padding: '0.25rem 0.6rem', borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}>
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
