import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ModelName, ModelStream, DebatePhase } from '../hooks/useDebateSocket.ts'

const MODEL_TONE: Record<ModelName, { rule: string; faint: string; display: string; latin: string }> = {
  claude:   { rule: 'var(--ochre)', faint: 'var(--ochre-faint)', display: 'Claude',   latin: 'Anthropic' },
  chatgpt:  { rule: 'var(--sage)',  faint: 'var(--sage-faint)',  display: 'ChatGPT',  latin: 'OpenAI'    },
  deepseek: { rule: 'var(--azure)', faint: 'var(--azure-faint)', display: 'DeepSeek', latin: 'Hangzhou'  },
}

const PHASE_ROMAN: Record<DebatePhase, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }
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
  const tone = MODEL_TONE[model]

  // Smooth auto-scroll only while streaming
  useEffect(() => {
    const lastStream = streams[streams.length - 1]
    if (lastStream && !lastStream.complete) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [streams])

  const isWriting = isActive && streams.some(s => !s.complete)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      borderLeft: `1px solid ${isActive ? tone.rule : 'var(--rule)'}`,
      paddingLeft: '1.4rem',
      transition: 'border-color 0.4s',
      position: 'relative',
    }}>
      {/* Column header — editorial byline */}
      <header style={{
        paddingBottom: '0.85rem',
        marginBottom: '1.1rem',
        borderBottom: '1px solid var(--rule)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.6rem',
        }}>
          <h3 style={{
            fontFamily: 'var(--serif-display)',
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 22,
            color: tone.rule,
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}>
            {tone.display}
          </h3>

          {isWriting && (
            <span style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: tone.rule,
            }}>
              <span className="writing-pulse" style={{ background: tone.rule }} />
              落笔中
            </span>
          )}
        </div>

        <div style={{
          marginTop: '0.35rem',
          fontFamily: 'var(--mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--paper-faint)',
        }}>
          {tone.latin} · 第 {streams.length || 0} 篇手稿
        </div>
      </header>

      {/* Body — flowing streams */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingRight: '0.4rem',
      }}>
        {streams.length === 0 && (
          <p style={{
            fontFamily: 'var(--serif-body)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--paper-faint)',
            marginTop: '0.5rem',
          }}>
            尚未发言。
          </p>
        )}

        {streams.map((stream, i) => (
          <article key={i} style={{ marginBottom: '2.2rem' }} className="fade-up">
            {/* Chapter mark — Roman numeral + label */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.55rem',
              marginBottom: '0.65rem',
              paddingBottom: '0.45rem',
              borderBottom: `1px solid ${tone.faint}`,
            }}>
              <span style={{
                fontFamily: 'var(--serif-display)',
                fontStyle: 'italic',
                fontSize: 17,
                color: tone.rule,
                fontFeatureSettings: '"onum" 1',
                lineHeight: 1,
              }}>
                {PHASE_ROMAN[stream.phase]}
              </span>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--paper-mute)',
              }}>
                {PHASE_LABELS[stream.phase]}
              </span>
              {!stream.complete && (
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: tone.rule,
                  opacity: 0.7,
                }}>
                  撰写中
                </span>
              )}
            </div>

            {/* The actual text — Newsreader serif, editorial body */}
            <div className="prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {stream.content}
              </ReactMarkdown>
              {!stream.complete && stream.content && (
                <span className="caret" style={{ background: tone.rule }} />
              )}
            </div>
          </article>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
