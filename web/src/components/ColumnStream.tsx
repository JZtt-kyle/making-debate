import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { ModelName, ModelStream, DebatePhase } from '../hooks/useDebateSocket.ts'

const MODEL_COLORS: Record<ModelName, string> = {
  claude: 'var(--claude)',
  chatgpt: 'var(--chatgpt)',
  deepseek: 'var(--deepseek)',
}

const PHASE_LABELS: Record<DebatePhase, string> = {
  1: '开题',
  2: '初步方案',
  3: '互相批评',
  4: '综合迭代',
}

interface Props {
  model: ModelName
  streams: ModelStream[]
  isActive: boolean
}

export default function ColumnStream({ model, streams, isActive }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streams])

  const color = MODEL_COLORS[model]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      border: `1px solid ${isActive ? color : 'var(--border)'}`,
      borderRadius: 10, overflow: 'hidden',
      transition: 'border-color 0.3s',
    }}>
      <div style={{
        padding: '0.7rem 1rem',
        background: 'var(--surface)',
        borderBottom: `2px solid ${color}`,
        display: 'flex', alignItems: 'center', gap: '0.5rem',
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: color,
          boxShadow: isActive ? `0 0 6px ${color}` : 'none',
          transition: 'box-shadow 0.3s',
        }} />
        <span style={{ fontWeight: 700, letterSpacing: '0.03em', color }}>
          {model === 'chatgpt' ? 'ChatGPT' : model.charAt(0).toUpperCase() + model.slice(1)}
        </span>
        {isActive && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
            生成中...
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {streams.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>等待中...</p>
        )}
        {streams.map((stream, i) => (
          <div key={i} style={{ marginBottom: '1.5rem' }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color, marginBottom: '0.5rem',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {PHASE_LABELS[stream.phase] ?? `阶段 ${stream.phase}`}
            </div>
            <div style={{
              fontSize: 14, lineHeight: 1.7, color: 'var(--text)',
              fontFamily: 'inherit',
            }}>
              <ReactMarkdown>{stream.content}</ReactMarkdown>
              {!stream.complete && stream.content && (
                <span style={{ color, animation: 'blink 1s step-start infinite' }}>▍</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <style>{`@keyframes blink { 50% { opacity: 0 } }`}</style>
    </div>
  )
}
