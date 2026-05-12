import type { DebatePhase } from '../../lib/phases.ts'
import { getPhaseMeta } from '../../lib/phases.ts'

// Shared section header for every PhaseView. Roman + title on the left,
// progress chip ("落笔中" / "已成稿" / "未付印") on the right.
export default function PhaseHeader({ phase, isActive, isAborted }: {
  phase: DebatePhase; isActive: boolean; isAborted: boolean
}) {
  const meta = getPhaseMeta(phase)
  const status = isAborted ? '未付印' : isActive ? '落笔中' : '已成稿'
  const statusColor = isAborted ? 'var(--vermilion)'
                     : isActive  ? 'var(--vermilion)'
                                 : 'var(--paper-faint)'

  return (
    <header style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: '1rem',
      marginBottom: '1.4rem',
    }}>
      <span style={{
        fontFamily: 'var(--serif-display)',
        fontStyle: 'italic',
        fontSize: 42,
        fontWeight: 400,
        color: isActive ? 'var(--vermilion)' : 'var(--paper)',
        fontFeatureSettings: '"onum" 1',
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        {meta.roman}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h2 className="display" style={{
          fontFamily: 'var(--serif-display)',
          fontSize: 26,
          fontWeight: 500,
          color: 'var(--paper)',
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}>{meta.label}</h2>
        <div className="byline" style={{ color: 'var(--paper-mute)' }}>
          {meta.subtitle}
        </div>
      </div>
      <span style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontFamily: 'var(--mono)',
        fontSize: 10,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: statusColor,
      }}>
        {isActive && !isAborted && (
          <span className="writing-pulse" style={{ background: 'var(--vermilion)' }} />
        )}
        {status}
      </span>
    </header>
  )
}
