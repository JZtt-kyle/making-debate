import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface Props {
  comparison: string
  finalProposal: string
  debateId: string
}

export default function SummaryPanel({ comparison, finalProposal, debateId }: Props) {
  const [tab, setTab] = useState<'comparison' | 'proposal'>('comparison')

  const exportMd = () => {
    window.open(`/api/debates/${debateId}/export`, '_blank')
  }

  const tabStyle = (active: boolean) => ({
    padding: '0.5rem 1.2rem',
    borderRadius: '6px 6px 0 0',
    cursor: 'pointer',
    border: 'none',
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    fontWeight: active ? 600 : 400,
    fontSize: 14,
  })

  return (
    <div style={{
      marginTop: '2rem',
      border: '1px solid var(--accent)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{
        background: 'var(--surface)',
        padding: '0.8rem 1rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
      }}>
        <span style={{ fontWeight: 700, color: 'var(--accent)', marginRight: 'auto' }}>
          辩论总结
        </span>
        <button style={tabStyle(tab === 'comparison')} onClick={() => setTab('comparison')} className="secondary">
          异同对照
        </button>
        <button style={tabStyle(tab === 'proposal')} onClick={() => setTab('proposal')} className="secondary">
          综合方案
        </button>
        <button onClick={exportMd} style={{ marginLeft: '0.5rem', padding: '0.4rem 0.9rem', fontSize: 13 }}>
          导出 Markdown
        </button>
      </div>

      <div style={{ padding: '1.2rem', maxHeight: 500, overflowY: 'auto', lineHeight: 1.8, fontSize: 14 }}>
        <ReactMarkdown>{tab === 'comparison' ? comparison : finalProposal}</ReactMarkdown>
      </div>
    </div>
  )
}
