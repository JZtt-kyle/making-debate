import { ReactNode, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ModelName, ModelStream, DebatePhase } from '../hooks/useDebateSocket.ts'
import ModelPanel from './ModelPanel.tsx'
import {
  parseCritiquesByTarget, type AnonLabel, type CritiqueSection,
} from '../lib/parseCritiques.ts'

const MODELS: ModelName[] = ['claude', 'chatgpt', 'deepseek']

const PHASE_DISPLAY: Record<DebatePhase, { roman: string; label: string; subtitle: string }> = {
  1: { roman: '序', label: '开题',     subtitle: '议题与设计原则' },
  2: { roman: 'I',  label: '各自方案', subtitle: '三方独立提出 · 结构化输出' },
  3: { roman: 'II', label: '匿名互评', subtitle: '盲审 · 按被评方案聚合' },
  4: { roman: 'III',label: '作者修订', subtitle: '回应批评 · 二次提案 · 坚守取舍' },
  5: { roman: 'IV', label: '综合裁决', subtitle: '异同 · 分歧 · 终稿 · 少数派' },
  6: { roman: 'V',  label: '终稿复核', subtitle: '非综合者 · 批准或否决' },
}

// -----------------------------------------------------------------------
// Shared header for any phase view.
// -----------------------------------------------------------------------
function PhaseHeader({ phase, isActive, isAborted }: {
  phase: DebatePhase; isActive: boolean; isAborted: boolean
}) {
  const d = PHASE_DISPLAY[phase]
  const status = isAborted ? '未付印' : isActive ? '落笔中' : '已成稿'
  const statusColor = isAborted ? 'var(--vermilion)' : isActive ? 'var(--vermilion)' : 'var(--paper-faint)'

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
        {d.roman}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h2 className="display" style={{
          fontFamily: 'var(--serif-display)',
          fontSize: 26,
          fontWeight: 500,
          color: 'var(--paper)',
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}>{d.label}</h2>
        <div className="byline" style={{ color: 'var(--paper-mute)' }}>{d.subtitle}</div>
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

// -----------------------------------------------------------------------
// Generic 3-column wrapper used for Phase II and IV.
// -----------------------------------------------------------------------
function ThreeColumns({ panels, isActivePhase }: {
  panels: Partial<Record<ModelName, ModelStream | null>>
  isActivePhase: boolean
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: 0,
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
  )
}

// -----------------------------------------------------------------------
// Phase II — 各自方案
// -----------------------------------------------------------------------
export function PhaseTwoView(props: {
  panels: Partial<Record<ModelName, ModelStream | null>>
  isActivePhase: boolean; isAborted: boolean
}) {
  return (
    <section className="fade-up">
      <PhaseHeader phase={2} isActive={props.isActivePhase} isAborted={props.isAborted} />
      <ThreeColumns panels={props.panels} isActivePhase={props.isActivePhase} />
    </section>
  )
}

// -----------------------------------------------------------------------
// Phase III — 匿名互评 (transposed by target proposal)
// -----------------------------------------------------------------------

const REVIEWER_TONE: Record<ModelName, string> = {
  claude:   'var(--ochre)',
  chatgpt:  'var(--sage)',
  deepseek: 'var(--azure)',
}

const REVIEWER_ABBR: Record<ModelName, string> = {
  claude:   'CL',
  chatgpt:  'GP',
  deepseek: 'DS',
}

const SECTIONS: { id: CritiqueSection; label: string; tone: string }[] = [
  { id: '决定性缺陷', label: '决定性缺陷', tone: 'var(--vermilion)' },
  { id: '可救的洞见', label: '可救的洞见', tone: 'var(--ochre)' },
  { id: '具体改动',   label: '具体改动',   tone: 'var(--sage)' },
]

// Ranking signal: aggregated rank per anon label, derived from Phase 3 streams.
// We don't have the aggregated signal in the live state — only the textual content.
// For the by-target card, just count "how many critics ranked this 1st/2nd/3rd"
// by re-parsing FINAL RANKING from each reviewer's content.
function rankingFromContent(content: string): AnonLabel[] | null {
  const idx = content.indexOf('FINAL RANKING')
  if (idx < 0) return null
  const tail = content.slice(idx).replace(/\\\./g, '.')
  const matches = Array.from(tail.matchAll(/\d+\.\s*方案\s*([甲乙丙])/g))
  if (matches.length === 0) return null
  const labels = matches.map(m => m[1] as AnonLabel)
  const seen = new Set<AnonLabel>()
  return labels.filter(l => seen.has(l) ? false : (seen.add(l), true))
}

export function PhaseThreeView(props: {
  panels: Partial<Record<ModelName, ModelStream | null>>
  // Fixed mapping: Phase 2 ordering → label. anonOrder[i] = the model assigned 甲/乙/丙.
  anonOrder: ModelName[]
  isActivePhase: boolean; isAborted: boolean
}) {
  const { panels, anonOrder, isActivePhase, isAborted } = props

  // Build the by-target view from streamed content (re-parses on each render —
  // cheap enough at this size and stays live during streaming).
  const { byTarget, ranks } = useMemo(() => {
    const phase3 = MODELS
      .map(m => ({ reviewer: m, content: panels[m]?.content ?? '' }))
      .filter(p => p.content.length > 0)
    const byTarget = parseCritiquesByTarget(phase3)
    // Each reviewer's ranking → aggregate avg rank per label
    const rankSums: Record<AnonLabel, { sum: number; count: number }> = {
      甲: { sum: 0, count: 0 }, 乙: { sum: 0, count: 0 }, 丙: { sum: 0, count: 0 },
    }
    for (const { content } of phase3) {
      const r = rankingFromContent(content)
      if (!r) continue
      r.forEach((l, i) => { rankSums[l].sum += i + 1; rankSums[l].count += 1 })
    }
    const ranks = {
      甲: rankSums.甲.count ? rankSums.甲.sum / rankSums.甲.count : null,
      乙: rankSums.乙.count ? rankSums.乙.sum / rankSums.乙.count : null,
      丙: rankSums.丙.count ? rankSums.丙.sum / rankSums.丙.count : null,
    } as Record<AnonLabel, number | null>
    return { byTarget, ranks }
  }, [panels.claude?.content, panels.chatgpt?.content, panels.deepseek?.content])

  const labels: AnonLabel[] = ['甲', '乙', '丙']

  return (
    <section className="fade-up">
      <PhaseHeader phase={3} isActive={isActivePhase} isAborted={isAborted} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '0.6rem',
      }}>
        {labels.map((label, i) => {
          const author = anonOrder[i]
          const rank = ranks[label]
          return (
            <TargetCard
              key={label}
              label={label}
              author={author}
              rank={rank}
              sections={byTarget[label]}
            />
          )
        })}
      </div>
      <p style={{
        marginTop: '1.2rem',
        fontFamily: 'var(--serif-body)',
        fontStyle: 'italic',
        fontSize: 13,
        color: 'var(--paper-faint)',
      }}>
        三位评审者在此阶段独立写作，不知道方案作者身份。作者身份 (
        {labels.map((l, i) => `方案${l}=${anonOrder[i] ?? '-'}`).join(' · ')}
        ) 仅在此处揭示，供阅读对照。
      </p>
    </section>
  )
}

function TargetCard({ label, author, rank, sections }: {
  label: AnonLabel
  author: ModelName | undefined
  rank: number | null
  sections: ReturnType<typeof parseCritiquesByTarget>[AnonLabel]
}) {
  const isWinner = rank !== null && rank < 1.5

  return (
    <div style={{
      borderLeft: '1px solid var(--rule)',
      paddingLeft: '1.1rem',
      paddingRight: '0.6rem',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }}>
      {/* Card header: 方案X (作者) + 排名 */}
      <header style={{
        paddingBottom: '0.55rem',
        marginBottom: '0.9rem',
        borderBottom: '1px solid var(--rule)',
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.6rem',
      }}>
        <h4 style={{
          fontFamily: 'var(--serif-display)',
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: 20,
          color: 'var(--paper)',
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}>
          方案{label}
        </h4>
        {author && (
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 9.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: author ? REVIEWER_TONE[author] : 'var(--paper-faint)',
          }}>
            {author}
          </span>
        )}
        {rank !== null && (
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            color: isWinner ? 'var(--paper)' : 'var(--paper-mute)',
          }}>
            盲审 #{rank.toFixed(2)}
          </span>
        )}
      </header>

      {SECTIONS.map(sec => {
        const points = sections[sec.id]
        return (
          <div key={sec.id} style={{ marginBottom: '1rem', minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.5rem',
              marginBottom: '0.4rem',
            }}>
              <span style={{
                width: 4,
                height: 14,
                background: sec.tone,
                display: 'inline-block',
                alignSelf: 'center',
              }} />
              <span style={{
                fontFamily: 'var(--serif-display)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--paper)',
                letterSpacing: 0,
              }}>{sec.label}</span>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--paper-faint)',
                marginLeft: 'auto',
              }}>{points.length}/3</span>
            </div>

            {points.length === 0 ? (
              <p style={{
                fontFamily: 'var(--serif-body)',
                fontStyle: 'italic',
                fontSize: 12,
                color: 'var(--paper-faint)',
                paddingLeft: '0.9rem',
              }}>等待评审…</p>
            ) : (
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
              }}>
                {points.map((p, i) => (
                  <li key={i} style={{
                    paddingLeft: '0.9rem',
                    marginBottom: '0.5rem',
                    position: 'relative',
                    fontFamily: 'var(--serif-body)',
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'var(--paper)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 9.5,
                      letterSpacing: '0.12em',
                      color: REVIEWER_TONE[p.reviewer as ModelName],
                      marginRight: '0.4rem',
                      fontWeight: 600,
                    }}>
                      {REVIEWER_ABBR[p.reviewer as ModelName] ?? p.reviewer}
                    </span>
                    {p.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

// -----------------------------------------------------------------------
// Phase IV — 作者修订
// -----------------------------------------------------------------------
export function PhaseFourView(props: {
  panels: Partial<Record<ModelName, ModelStream | null>>
  isActivePhase: boolean; isAborted: boolean
}) {
  return (
    <section className="fade-up">
      <PhaseHeader phase={4} isActive={props.isActivePhase} isAborted={props.isAborted} />
      <ThreeColumns panels={props.panels} isActivePhase={props.isActivePhase} />
    </section>
  )
}

// -----------------------------------------------------------------------
// Phase V — 综合裁决 (4 explicit cards instead of raw md + tabs)
// -----------------------------------------------------------------------
export function PhaseFiveView(props: {
  synthesizer: ModelName | undefined
  stream: ModelStream | null | undefined
  summary: { comparison: string; finalProposal: string; dissent?: string } | null
  isActivePhase: boolean; isAborted: boolean
}) {
  const { synthesizer, stream, summary, isActivePhase, isAborted } = props
  const hasSummary = summary && (summary.comparison || summary.finalProposal || summary.dissent)

  return (
    <section className="fade-up">
      <PhaseHeader phase={5} isActive={isActivePhase} isAborted={isAborted} />

      {/* Synthesizer attribution strip */}
      {synthesizer && (
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.7rem',
          marginBottom: '1.4rem',
          paddingBottom: '0.6rem',
          borderBottom: '1px solid var(--rule)',
        }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--paper-mute)',
          }}>
            综合者
          </span>
          <span style={{
            fontFamily: 'var(--serif-display)',
            fontStyle: 'italic',
            fontSize: 18,
            color: REVIEWER_TONE[synthesizer],
            fontWeight: 500,
          }}>
            {synthesizer}
          </span>
          {isActivePhase && (
            <span style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--vermilion)',
            }}>
              <span className="writing-pulse" style={{ background: 'var(--vermilion)' }} />
              落笔中
            </span>
          )}
        </div>
      )}

      {/* While streaming + before parsed sections land, show the raw stream
          as a fallback so the user sees progress. */}
      {!hasSummary && stream && stream.content && (
        <div className="prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{stream.content}</ReactMarkdown>
        </div>
      )}

      {!hasSummary && (!stream || !stream.content) && (
        <p style={{
          fontFamily: 'var(--serif-body)',
          fontStyle: 'italic',
          color: 'var(--paper-faint)',
        }}>
          {isActivePhase ? '综合者执笔待书…' : '尚未综合。'}
        </p>
      )}

      {/* Once parsed: 4 explicit cards. */}
      {hasSummary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>
          <SummaryCard kind="comparison" body={summary!.comparison} />
          <SummaryCard kind="proposal"   body={summary!.finalProposal} />
          {summary!.dissent && <SummaryCard kind="dissent" body={summary!.dissent} />}
        </div>
      )}
    </section>
  )
}

function SummaryCard({ kind, body }: {
  kind: 'comparison' | 'proposal' | 'dissent'
  body: string
}) {
  const META = {
    comparison: { label: '异同对照 · 关键分歧裁决', tone: 'var(--paper-mute)' },
    proposal:   { label: '迭代后的综合方案',        tone: 'var(--paper)' },
    dissent:    { label: '少数派意见',              tone: 'var(--ochre)' },
  }[kind]

  return (
    <article style={{
      borderLeft: `2px solid ${META.tone}`,
      paddingLeft: '1.2rem',
      paddingRight: '0.4rem',
    }}>
      <h3 style={{
        fontFamily: 'var(--mono)',
        fontSize: 10.5,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: META.tone,
        marginBottom: '0.8rem',
        fontWeight: 600,
      }}>
        {META.label}
      </h3>
      <div className="prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </article>
  )
}

// -----------------------------------------------------------------------
// Phase VI — 终稿复核 (2 reviewer cards, synthesizer skipped entirely)
// -----------------------------------------------------------------------

function readVerdict(content: string | undefined): {
  text: string; tone: string; reason: string
} | null {
  if (!content) return null
  const cleaned = content.replace(/\\\./g, '.')
  const m = cleaned.match(/VERDICT:\s*(RATIFY|VETO)\s*(?:[—\-:]\s*(.+))?/i)
  if (!m) return null
  const verdict = m[1].toUpperCase()
  return verdict === 'RATIFY'
    ? { text: '批准', tone: 'var(--paper)', reason: '' }
    : { text: '否决', tone: 'var(--vermilion)', reason: (m[2] ?? '').trim() }
}

export function PhaseSixView(props: {
  panels: Partial<Record<ModelName, ModelStream | null>>
  synthesizer: ModelName | undefined
  isActivePhase: boolean; isAborted: boolean
}) {
  const { panels, synthesizer, isActivePhase, isAborted } = props
  const reviewers = MODELS.filter(m => m !== synthesizer)

  return (
    <section className="fade-up">
      <PhaseHeader phase={6} isActive={isActivePhase} isAborted={isAborted} />

      {synthesizer && (
        <p style={{
          fontFamily: 'var(--serif-body)',
          fontStyle: 'italic',
          fontSize: 13.5,
          color: 'var(--paper-mute)',
          marginBottom: '1.4rem',
          paddingBottom: '0.7rem',
          borderBottom: '1px dashed var(--rule)',
        }}>
          综合者 <em style={{
            fontFamily: 'var(--serif-display)',
            fontStyle: 'italic',
            color: REVIEWER_TONE[synthesizer],
            fontWeight: 500,
          }}>{synthesizer}</em> 不参与本环节复核；以下两位以独立审稿人身份给出 ≤200 字判断。
        </p>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '1.4rem',
      }}>
        {reviewers.map(m => (
          <ReviewerCard
            key={m}
            model={m}
            stream={panels[m] ?? null}
            isActivePhase={isActivePhase}
          />
        ))}
      </div>
    </section>
  )
}

function ReviewerCard({ model, stream, isActivePhase }: {
  model: ModelName
  stream: ModelStream | null
  isActivePhase: boolean
}) {
  const verdict = readVerdict(stream?.content)
  const tone = REVIEWER_TONE[model]
  const isWriting = !!stream && !stream.complete && isActivePhase
  // Strip the VERDICT line from the displayed body — we surface it as a badge.
  const body = stream?.content?.replace(/\n?VERDICT:.*$/i, '').trim() ?? ''

  return (
    <article style={{
      borderLeft: `1px solid ${isWriting ? tone : 'var(--rule)'}`,
      paddingLeft: '1.2rem',
      paddingRight: '0.6rem',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      transition: 'border-color 0.4s',
    }}>
      <header style={{
        paddingBottom: '0.6rem',
        marginBottom: '0.9rem',
        borderBottom: '1px solid var(--rule)',
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.7rem',
      }}>
        <h4 style={{
          fontFamily: 'var(--serif-display)',
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: 20,
          color: tone,
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}>
          {model}
        </h4>
        {verdict && (
          <span style={{
            marginLeft: 'auto',
            padding: '0.18rem 0.55rem',
            border: `1px solid ${verdict.tone}`,
            color: verdict.tone,
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            {verdict.text}
          </span>
        )}
        {!verdict && isWriting && (
          <span style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: tone,
          }}>
            <span className="writing-pulse" style={{ background: tone }} />
            落笔中
          </span>
        )}
      </header>

      <div className="prose" style={{ minWidth: 0 }}>
        {body ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
        ) : (
          <p style={{
            fontFamily: 'var(--serif-body)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--paper-faint)',
          }}>
            {isActivePhase ? '执笔待书…' : '尚未发言。'}
          </p>
        )}
        {verdict?.reason && (
          <p style={{
            marginTop: '0.8rem',
            paddingTop: '0.6rem',
            borderTop: '1px dashed var(--rule)',
            fontFamily: 'var(--serif-body)',
            fontSize: 13,
            color: 'var(--paper-mute)',
            fontStyle: 'italic',
          }}>
            否决理由：{verdict.reason}
          </p>
        )}
      </div>
    </article>
  )
}

// -----------------------------------------------------------------------
// PhaseHeader needs ReactNode import to avoid TS unused warning
// (it's used implicitly via JSX). Re-export the type table for outside use.
// -----------------------------------------------------------------------
export { PHASE_DISPLAY }
export type { ReactNode }
