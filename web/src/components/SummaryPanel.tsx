import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  comparison: string
  finalProposal: string
  debateId: string
}

const TABS = [
  { id: 'comparison', roman: 'V',  label: '异同对照' },
  { id: 'proposal',   roman: 'VI', label: '综合方案' },
] as const

type TabId = typeof TABS[number]['id']

export default function SummaryPanel({ comparison, finalProposal, debateId }: Props) {
  const [tab, setTab] = useState<TabId>('comparison')

  const exportMd = () => {
    window.open(`/api/debates/${debateId}/export`, '_blank')
  }

  const content = tab === 'comparison' ? comparison : finalProposal

  return (
    <section style={{
      marginTop: '2.5rem',
      borderTop: '1.5px solid var(--paper)',
      paddingTop: '1.4rem',
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '2rem',
        flexWrap: 'wrap',
        marginBottom: '1.4rem',
      }}>
        <div>
          <div className="byline" style={{ marginBottom: '0.4rem' }}>编后记</div>
          <h2 className="display" style={{
            fontSize: 32,
            fontWeight: 600,
            fontStyle: 'italic',
            color: 'var(--paper)',
          }}>
            汇编 <span style={{ color: 'var(--vermilion)' }}>·</span> 终稿
          </h2>
        </div>

        <nav style={{
          display: 'flex',
          gap: '1.6rem',
          marginLeft: 'auto',
          alignItems: 'center',
        }}>
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0.4rem 0',
                  borderBottom: `1.5px solid ${active ? 'var(--vermilion)' : 'transparent'}`,
                  borderRadius: 0,
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  color: active ? 'var(--paper)' : 'var(--paper-mute)',
                  fontFamily: 'var(--serif-display)',
                  fontWeight: active ? 600 : 500,
                  fontSize: 15,
                  letterSpacing: 0,
                  textTransform: 'none',
                }}
              >
                <span style={{
                  fontStyle: 'italic',
                  color: active ? 'var(--vermilion)' : 'var(--paper-faint)',
                  fontSize: 14,
                  fontFeatureSettings: '"onum" 1',
                }}>
                  {t.roman}
                </span>
                {t.label}
              </button>
            )
          })}

          <button onClick={exportMd} className="ghost" style={{
            marginLeft: '0.6rem',
          }}>
            导出
          </button>
        </nav>
      </header>

      <div className="prose fade-up" key={tab} style={{
        maxHeight: 540,
        overflowY: 'auto',
        paddingRight: '0.5rem',
      }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </section>
  )
}
