import { DebatePhase } from '../hooks/useDebateSocket.ts'

const PHASE_LABELS: Record<DebatePhase, string> = {
  1: '开题',
  2: '各自方案',
  3: '匿名互评',
  4: '作者修订',
  5: '综合裁决',
  6: '终稿复核',
}

const ROMAN: Record<DebatePhase, string> = {
  1: '序', 2: 'I', 3: 'II', 4: 'III', 5: 'IV', 6: 'V',
}

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
  const hasPrev = prevPhase >= 2
  const hasNext = nextPhase <= 6

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
              {ROMAN[prevPhase]}
            </span>
            {PHASE_LABELS[prevPhase]}
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
            {PHASE_LABELS[nextPhase]}
            <span style={{
              fontStyle: 'italic',
              color: 'var(--paper-faint)',
              marginLeft: '0.4rem',
            }}>
              {ROMAN[nextPhase]}
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
