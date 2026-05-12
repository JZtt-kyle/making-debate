import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ModelName, ModelStream } from '../hooks/useDebateSocket.ts'

const MODEL_TONE: Record<ModelName, { rule: string; display: string; latin: string }> = {
  claude:   { rule: 'var(--ochre)', display: 'Claude',   latin: 'Anthropic' },
  chatgpt:  { rule: 'var(--sage)',  display: 'ChatGPT',  latin: 'OpenAI'    },
  deepseek: { rule: 'var(--azure)', display: 'DeepSeek', latin: 'Hangzhou'  },
}

interface Props {
  model: ModelName
  stream: ModelStream | null
  isActivePhase: boolean
  /** When true, render this column as "本环节不参与" (e.g., synthesizer in Phase 6 review). */
  abstain?: boolean
  /** Optional label rendered in the column header (e.g., a verdict badge). */
  badge?: { text: string; tone: 'paper' | 'vermilion' | 'mute' }
}

// One model's output inside ONE phase. Used as a column within PhaseSection.
// Auto-scrolls to keep the streaming tail visible.
export default function ModelPanel({ model, stream, isActivePhase, abstain, badge }: Props) {
  const tone = MODEL_TONE[model]
  const bottomRef = useRef<HTMLDivElement>(null)
  const isWriting = !!stream && !stream.complete && isActivePhase && !abstain

  useEffect(() => {
    if (isWriting) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [stream?.content, isWriting])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderLeft: `1px solid ${isWriting ? tone.rule : 'var(--rule)'}`,
      paddingLeft: '1.1rem',
      paddingRight: '0.6rem',
      transition: 'border-color 0.4s',
      minWidth: 0,
    }}>
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
          fontSize: 18,
          color: tone.rule,
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}>
          {tone.display}
        </h4>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 9.5,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--paper-faint)',
        }}>
          {tone.latin}
        </span>
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
        {badge && !isWriting && (
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: badge.tone === 'vermilion' ? 'var(--vermilion)'
                  : badge.tone === 'mute'      ? 'var(--paper-mute)'
                                               : 'var(--paper)',
          }}>
            {badge.text}
          </span>
        )}
      </header>

      <div className="prose" style={{ minWidth: 0 }}>
        {abstain ? (
          <p style={{
            fontFamily: 'var(--serif-body)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--paper-faint)',
          }}>
            综合者本环节不参与复核。
          </p>
        ) : !stream || stream.content.length === 0 ? (
          <p style={{
            fontFamily: 'var(--serif-body)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--paper-faint)',
          }}>
            {isActivePhase ? '执笔待书…' : '尚未发言。'}
          </p>
        ) : (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {stream.content}
            </ReactMarkdown>
            {isWriting && <span className="caret" style={{ background: tone.rule }} />}
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
