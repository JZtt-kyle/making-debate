import { ReactNode } from 'react'
import { ModelName, ModelStream, DebatePhase } from '../hooks/useDebateSocket.ts'
import ModelPanel from './ModelPanel.tsx'

const MODELS: ModelName[] = ['claude', 'chatgpt', 'deepseek']

// DB phase id → display roman / label (phase 1 is "开题" — never has model output)
// 5-phase iteration: II 各自方案 → III 匿名互评 → IV 作者修订 → V 综合 → VI 终稿复核
export const PHASE_DISPLAY: Record<DebatePhase, { roman: string; label: string; subtitle: string }> = {
  1: { roman: '序', label: '开题',     subtitle: '议题与设计原则' },
  2: { roman: 'I',  label: '各自方案', subtitle: '三方独立提出' },
  3: { roman: 'II', label: '匿名互评', subtitle: '盲审 · 风险与排名' },
  4: { roman: 'III',label: '作者修订', subtitle: '回应批评 · 二次提案' },
  5: { roman: 'IV', label: '综合裁决', subtitle: '异同 · 分歧 · 终稿 · 少数派' },
  6: { roman: 'V',  label: '终稿复核', subtitle: '非综合者 · 批准或否决' },
}

interface Props {
  phase: DebatePhase
  panels: Partial<Record<ModelName, ModelStream | null>>
  isActivePhase: boolean
  isAborted?: boolean
  /** Phase V: render a single wide column (synthesizer only) + optional extra slot. */
  singleColumn?: ModelName
  /** Phase VI: this model is sitting out (synthesizer skips its own review). */
  abstainModel?: ModelName
  /** Optional content rendered below the columns (e.g., comparison table / final proposal). */
  children?: ReactNode
}

// Parse "VERDICT: RATIFY" / "VERDICT: VETO — ..." from a Phase 6 stream.
function readVerdict(content: string | undefined): { text: string; tone: 'paper' | 'vermilion' | 'mute' } | null {
  if (!content) return null
  const cleaned = content.replace(/\\\./g, '.')
  const m = cleaned.match(/VERDICT:\s*(RATIFY|VETO)/i)
  if (!m) return null
  const verdict = m[1].toUpperCase()
  return verdict === 'RATIFY'
    ? { text: '批准 · RATIFY', tone: 'paper' }
    : { text: '否决 · VETO',   tone: 'vermilion' }
}

export default function PhaseSection({
  phase, panels, isActivePhase, isAborted = false, singleColumn, abstainModel, children,
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
          {MODELS.map(m => {
            const isAbstain = abstainModel === m
            // Phase VI: parse verdict and surface it as a header badge.
            const verdictBadge = phase === 6 && !isAbstain
              ? readVerdict(panels[m]?.content) ?? undefined
              : undefined
            return (
              <ModelPanel
                key={m}
                model={m}
                stream={panels[m] ?? null}
                isActivePhase={isActivePhase && !isAbstain}
                abstain={isAbstain}
                badge={verdictBadge}
              />
            )
          })}
        </div>
      )}

      {children && (
        <div style={{ marginTop: '1.6rem' }}>{children}</div>
      )}
    </section>
  )
}
