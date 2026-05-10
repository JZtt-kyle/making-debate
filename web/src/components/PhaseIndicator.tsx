import { DebatePhase } from '../hooks/useDebateSocket.ts'

const PHASES: { id: DebatePhase; label: string }[] = [
  { id: 1, label: '开题' },
  { id: 2, label: '各自方案' },
  { id: 3, label: '互相批评' },
  { id: 4, label: '综合迭代' },
]

export default function PhaseIndicator({ current, done }: { current: DebatePhase; done: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '1.5rem' }}>
      {PHASES.map((p, i) => {
        const active = p.id === current && !done
        const complete = p.id < current || done
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: complete ? 'var(--accent)' : active ? 'var(--accent)' : 'var(--surface2)',
                border: active ? '2px solid #fff' : '2px solid var(--border)',
                color: complete || active ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, margin: '0 auto 4px',
                opacity: complete ? 0.7 : 1,
              }}>
                {complete ? '✓' : p.id}
              </div>
              <div style={{ fontSize: 11, color: active ? 'var(--text)' : 'var(--text-muted)' }}>
                {p.label}
              </div>
            </div>
            {i < PHASES.length - 1 && (
              <div style={{
                height: 2, flex: 0.3,
                background: p.id < current || done ? 'var(--accent)' : 'var(--border)',
                opacity: 0.6,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
