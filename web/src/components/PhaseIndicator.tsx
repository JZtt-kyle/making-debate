import { DebatePhase } from '../hooks/useDebateSocket.ts'

// Phase 1 is conceptual ("开题") and produces no model output, so it isn't
// surfaced. DB ids 2-6 are the five working phases, displayed as roman I-V.
const PHASES: { id: DebatePhase; roman: string; label: string }[] = [
  { id: 2, roman: 'I',   label: '各自方案' },
  { id: 3, roman: 'II',  label: '匿名互评' },
  { id: 4, roman: 'III', label: '作者修订' },
  { id: 5, roman: 'IV',  label: '综合裁决' },
  { id: 6, roman: 'V',   label: '终稿复核' },
]

export default function PhaseIndicator({ current, done, aborted = false }:
  { current: DebatePhase; done: boolean; aborted?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 0,
      borderTop: '1px solid var(--rule)',
      borderBottom: '1px solid var(--rule)',
      padding: '0.9rem 0',
    }}>
      {PHASES.map((p, i) => {
        const isActive = p.id === current && !done && !aborted
        const isComplete = (p.id < current || done) && !(aborted && p.id >= current)
        const isAbortedHere = aborted && p.id === current
        const isPending = !isActive && !isComplete && !isAbortedHere

        const tone = isAbortedHere ? 'var(--vermilion)'
                   : isActive    ? 'var(--vermilion)'
                   : isComplete  ? 'var(--paper)'
                                 : 'var(--paper-faint)'

        return (
          <div key={p.id} style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            paddingLeft: i === 0 ? 0 : '1.2rem',
          }}>
            {/* Vertical separator between phases (editorial column rule) */}
            {i > 0 && (
              <div style={{
                position: 'absolute',
                left: 0,
                top: '-0.5rem',
                bottom: '-0.5rem',
                width: 1,
                background: 'var(--rule)',
              }} />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.6rem',
              }}>
                <span style={{
                  fontFamily: 'var(--serif-display)',
                  fontStyle: 'italic',
                  fontSize: 22,
                  fontWeight: 400,
                  color: tone,
                  fontFeatureSettings: '"onum" 1',
                  lineHeight: 1,
                  transition: 'color 0.4s',
                }}>
                  {p.roman}
                </span>

                <span style={{
                  fontFamily: 'var(--serif-display)',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  color: tone,
                  letterSpacing: isPending ? '0.01em' : 0,
                  transition: 'color 0.4s',
                }}>
                  {p.label}
                </span>

                {isActive && (
                  <span className="writing-pulse" style={{
                    background: 'var(--vermilion)',
                    marginLeft: 'auto',
                    marginRight: i === PHASES.length - 1 ? 0 : '0.4rem',
                  }} />
                )}

                {isComplete && (
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    letterSpacing: '0.18em',
                    color: 'var(--paper-faint)',
                    marginLeft: 'auto',
                    marginRight: i === PHASES.length - 1 ? 0 : '0.4rem',
                    textTransform: 'uppercase',
                  }}>
                    定稿
                  </span>
                )}

                {isAbortedHere && (
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    letterSpacing: '0.18em',
                    color: 'var(--vermilion)',
                    marginLeft: 'auto',
                    marginRight: i === PHASES.length - 1 ? 0 : '0.4rem',
                    textTransform: 'uppercase',
                  }}>
                    未付印
                  </span>
                )}
              </div>

              {/* Active underline: vermilion bar that grows under active phase.
                  Aborted: dashed vermilion. Pending: invisible. Complete: faint paper. */}
              <div style={{
                height: 2,
                width: isActive || isComplete || isAbortedHere ? '100%' : '0%',
                background: isActive ? 'var(--vermilion)'
                          : isAbortedHere ? 'transparent'
                          : 'var(--rule)',
                borderTop: isAbortedHere ? '1.5px dashed var(--vermilion)' : 'none',
                opacity: isActive ? 1 : isComplete ? 0.4 : isAbortedHere ? 0.7 : 0,
                transition: 'all 0.5s cubic-bezier(0.2,0.7,0.2,1)',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
