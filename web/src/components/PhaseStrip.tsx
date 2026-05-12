import { DebatePhase } from '../hooks/useDebateSocket.ts'
import { WORKING_PHASES, getPhaseMeta } from '../lib/phases.ts'

interface Props {
  viewPhase: DebatePhase
  debateCurrentPhase: DebatePhase
  done: boolean
  aborted: boolean
  onSelect: (p: DebatePhase) => void
}

// Top phase navigator for the "one-phase-at-a-time" layout.
// Three states per tab: completed / current / pending. Click to jump.
export default function PhaseStrip({
  viewPhase, debateCurrentPhase, done, aborted, onSelect,
}: Props) {
  return (
    <div style={{
      display: 'flex',
      borderTop: '1px solid var(--rule)',
      borderBottom: '1px solid var(--rule)',
      padding: '0.4rem 0',
      marginBottom: '0.4rem',
    }}>
      {WORKING_PHASES.map((id, i) => {
        const meta = getPhaseMeta(id)
        const isViewing = id === viewPhase
        const isCompleted = (id < debateCurrentPhase || done) && !(aborted && id >= debateCurrentPhase)
        const isRunning = !done && !aborted && id === debateCurrentPhase
        const isPending = !isCompleted && !isRunning
        const isAbortedHere = aborted && id === debateCurrentPhase

        // Color logic: viewing state always trumps progress state.
        const labelColor = isViewing ? 'var(--paper)'
                         : isCompleted ? 'var(--paper-mute)'
                         : 'var(--paper-faint)'
        const accent = isAbortedHere ? 'var(--vermilion)'
                     : isRunning      ? 'var(--vermilion)'
                     : isViewing      ? 'var(--paper)'
                                      : 'transparent'

        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid var(--rule)',
              borderRadius: 0,
              padding: '0.7rem 0.4rem 0.55rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.3rem',
              position: 'relative',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.55rem',
              width: '100%',
            }}>
              <span style={{
                fontFamily: 'var(--serif-display)',
                fontStyle: 'italic',
                fontSize: 22,
                fontWeight: 400,
                color: labelColor,
                lineHeight: 1,
                fontFeatureSettings: '"onum" 1',
              }}>
                {meta.roman}
              </span>
              <span style={{
                fontFamily: 'var(--serif-display)',
                fontSize: 14,
                fontWeight: isViewing ? 600 : 500,
                color: labelColor,
                lineHeight: 1.2,
                letterSpacing: 0,
              }}>
                {meta.label}
              </span>
              {isRunning && (
                <span className="writing-pulse" style={{
                  background: 'var(--vermilion)',
                  marginLeft: 'auto',
                  marginRight: '0.1rem',
                }} />
              )}
              {isCompleted && !isRunning && !isAbortedHere && (
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--paper-faint)',
                }}>定稿</span>
              )}
              {isPending && (
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--paper-faint)',
                }}>待开</span>
              )}
            </div>

            {/* Active underline */}
            <div style={{
              height: 2,
              width: '100%',
              background: accent,
              borderTop: isAbortedHere ? '1.5px dashed var(--vermilion)' : 'none',
              opacity: isViewing || isRunning || isAbortedHere ? 1 : isCompleted ? 0.35 : 0,
              transition: 'all 0.35s cubic-bezier(0.2,0.7,0.2,1)',
            }} />
          </button>
        )
      })}
    </div>
  )
}
