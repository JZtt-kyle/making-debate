import { ReactNode } from 'react'
import { ModelName, ModelStream, DebatePhase } from '../hooks/useDebateSocket.ts'
import ModelPanel from './ModelPanel.tsx'

const MODELS: ModelName[] = ['claude', 'chatgpt', 'deepseek']

// DB phase id → display roman / label (phase 1 is "开题" — never has model output)
export const PHASE_DISPLAY: Record<DebatePhase, { roman: string; label: string; subtitle: string }> = {
  1: { roman: '序', label: '开题',     subtitle: '议题与设计原则' },
  2: { roman: 'I',  label: '各自方案', subtitle: '三方独立提出' },
  3: { roman: 'II', label: '互相批评', subtitle: '匿名盲审 · 风险与改进' },
  4: { roman: 'III',label: '综合迭代', subtitle: '综合者整合产出' },
}

interface Props {
  phase: DebatePhase
  panels: Partial<Record<ModelName, ModelStream | null>>
  isActivePhase: boolean
  isAborted?: boolean
  /** Phase IV: render a single wide column (synthesizer only) + optional extra slot. */
  singleColumn?: ModelName
  /** Optional content rendered below the columns (e.g., comparison table / final proposal). */
  children?: ReactNode
}

export default function PhaseSection({
  phase, panels, isActivePhase, isAborted = false, singleColumn, children,
}: Props) {
  const display = PHASE_DISPLAY[phase]
  const status = isAborted ? '未付印' : isActivePhase ? '落笔中' : '已成稿'
  const statusColor = isAborted ? 'var(--vermilion)'
                     : isActivePhase ? 'var(--vermilion)'
                                     : 'var(--paper-faint)'

  return (
    <section
      id={`phase-${phase}`}
      className="fade-up"
      style={{
        padding: '2rem 0 2.4rem',
        borderTop: '1.5px solid var(--paper)',
      }}
    >
      <header style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '1rem',
        marginBottom: '1.4rem',
      }}>
        <span style={{
          fontFamily: 'var(--serif-display)',
          fontStyle: 'italic',
          fontSize: 38,
          fontWeight: 400,
          color: isActivePhase ? 'var(--vermilion)' : 'var(--paper)',
          fontFeatureSettings: '"onum" 1',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>
          {display.roman}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h2 className="display" style={{
            fontFamily: 'var(--serif-display)',
            fontSize: 24,
            fontWeight: 500,
            color: 'var(--paper)',
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}>
            {display.label}
          </h2>
          <div className="byline" style={{ color: 'var(--paper-mute)' }}>
            {display.subtitle}
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
          {isActivePhase && !isAborted && (
            <span className="writing-pulse" style={{ background: 'var(--vermilion)' }} />
          )}
          {status}
        </span>
      </header>

      {singleColumn ? (
        <div style={{ paddingLeft: 0 }}>
          <ModelPanel
            model={singleColumn}
            stream={panels[singleColumn] ?? null}
            isActivePhase={isActivePhase}
          />
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '0',
        }}>
          {MODELS.map(m => (
            <ModelPanel
              key={m}
              model={m}
              stream={panels[m] ?? null}
              isActivePhase={isActivePhase}
            />
          ))}
        </div>
      )}

      {children && (
        <div style={{ marginTop: '1.6rem' }}>{children}</div>
      )}
    </section>
  )
}
