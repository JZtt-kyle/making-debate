import type { DebatePhase } from '../lib/phases.ts'
import { getPhaseMeta, PHASE_MIN, PHASE_MAX } from '../lib/phases.ts'

interface Props {
  viewPhase: DebatePhase
  onPrev: () => void
  onNext: () => void
  onExport?: () => void
  canExport: boolean
}

// Bottom navigation between phases. Disabled at edges.
// Export button surfaces here so it's always within thumb reach.
export default function PhaseFooterNav({
  viewPhase, onPrev, onNext, onExport, canExport,
}: Props) {
  const prevPhase = (viewPhase - 1) as DebatePhase
  const nextPhase = (viewPhase + 1) as DebatePhase
  const hasPrev = prevPhase >= PHASE_MIN
  const hasNext = nextPhase <= PHASE_MAX
  const prevMeta = getPhaseMeta(prevPhase)
  const nextMeta = getPhaseMeta(nextPhase)

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1.4rem',
      marginTop: '2.6rem',
      paddingTop: '1.4rem',
      borderTop: '1px solid var(--rule)',
    }}>
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        className="ghost"
        style={{
          flex: 1,
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          padding: '0.6rem 0',
          color: hasPrev ? 'var(--paper-mute)' : 'var(--paper-faint)',
          cursor: hasPrev ? 'pointer' : 'default',
          fontFamily: 'var(--serif-display)',
          fontSize: 15,
          opacity: hasPrev ? 1 : 0.4,
        }}
      >
        {hasPrev ? (
          <>
            <span style={{ marginRight: '0.55rem', color: 'var(--paper-faint)' }}>◂</span>
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--paper-faint)',
              marginRight: '0.55rem',
            }}>上一幕</span>
            <span style={{
              fontStyle: 'italic',
              color: 'var(--paper-faint)',
              marginRight: '0.4rem',
            }}>
              {prevMeta.roman}
            </span>
            {prevMeta.label}
          </>
        ) : ''}
      </button>

      {canExport && onExport && (
        <button
          onClick={onExport}
          className="ghost"
          style={{ flexShrink: 0 }}
        >
          导出 MD
        </button>
      )}

      <button
        onClick={onNext}
        disabled={!hasNext}
        className="ghost"
        style={{
          flex: 1,
          textAlign: 'right',
          background: 'transparent',
          border: 'none',
          padding: '0.6rem 0',
          color: hasNext ? 'var(--paper-mute)' : 'var(--paper-faint)',
          cursor: hasNext ? 'pointer' : 'default',
          fontFamily: 'var(--serif-display)',
          fontSize: 15,
          opacity: hasNext ? 1 : 0.4,
        }}
      >
        {hasNext ? (
          <>
            {nextMeta.label}
            <span style={{
              fontStyle: 'italic',
              color: 'var(--paper-faint)',
              marginLeft: '0.4rem',
            }}>
              {nextMeta.roman}
            </span>
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--paper-faint)',
              marginLeft: '0.55rem',
              marginRight: '0.55rem',
            }}>下一幕</span>
            <span style={{ color: 'var(--paper-faint)' }}>▸</span>
          </>
        ) : ''}
      </button>
    </nav>
  )
}
