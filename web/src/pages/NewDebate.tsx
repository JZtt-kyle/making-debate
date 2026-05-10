import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'

type ModelName = 'claude' | 'chatgpt' | 'deepseek'
type LoginStatus = Record<ModelName, boolean>

export default function NewDebate() {
  const [topic, setTopic] = useState('')
  const [principles, setPrinciples] = useState('')
  const [synthesizer, setSynthesizer] = useState<ModelName>('claude')
  const [submitting, setSubmitting] = useState(false)
  const [loginStatus, setLoginStatus] = useState<LoginStatus | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setLoginStatus(d.loginStatus ?? null))
      .catch(() => setLoginStatus(null))
  }, [])

  const allLoggedIn = loginStatus
    ? Object.values(loginStatus).every(Boolean)
    : false

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), principles: principles.trim(), synthesizer }),
      })
      const { id } = await res.json()
      navigate(`/debates/${id}`)
    } catch (err) {
      console.error(err)
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', fontSize: 14 }}>← 返回</Link>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>新建辩论</h1>
      </div>

      {loginStatus && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '0.8rem 1rem' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>浏览器登录状态</div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {(['claude', 'chatgpt', 'deepseek'] as ModelName[]).map(m => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: loginStatus[m] ? 'var(--chatgpt)' : 'var(--danger)',
                }} />
                <span style={{ fontSize: 13 }}>{m}</span>
              </div>
            ))}
          </div>
          {!allLoggedIn && (
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>
              请先在浏览器中登录所有三个站点，再开始辩论。
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label>议题 / 方案描述 *</label>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            rows={5}
            placeholder="描述你想让三个模型讨论的方案、设计或问题..."
            required
          />
        </div>

        <div className="field">
          <label>设计原则 / 约束条件（可选）</label>
          <textarea
            value={principles}
            onChange={e => setPrinciples(e.target.value)}
            rows={3}
            placeholder="例如：简洁优先、低运维成本、面向初学者..."
          />
        </div>

        <div className="field">
          <label>综合迭代者（由哪个模型负责最后的方案综合）</label>
          <select value={synthesizer} onChange={e => setSynthesizer(e.target.value as ModelName)}>
            <option value="claude">Claude</option>
            <option value="chatgpt">ChatGPT</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>

        <button type="submit" disabled={submitting || !topic.trim()} style={{ width: '100%' }}>
          {submitting ? '正在启动辩论...' : '开始辩论'}
        </button>
      </form>
    </div>
  )
}
