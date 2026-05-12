// Small "重新获取 ↻" affordance shown in the header of any phase × model
// cell whose stored output looks bad (rate-limit placeholder, empty, etc.).
// Clicking it asks the server to re-read the live model tab and replace
// the stored content. Used by ModelPanel and ReviewerCard.

export default function RefetchButton({ onClick, hasNeighborOnRight = false }: {
  onClick: () => void
  /** When true, sit next to whatever is already on the right (e.g. a badge),
   *  instead of taking the marginLeft:auto position. */
  hasNeighborOnRight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title="重新从模型 tab 抓取本格的最新回复"
      style={{
        marginLeft: hasNeighborOnRight ? '0.6rem' : 'auto',
        background: 'transparent',
        border: '1px solid var(--rule)',
        borderRadius: 0,
        padding: '0.18rem 0.55rem',
        color: 'var(--paper-mute)',
        fontFamily: 'var(--mono)',
        fontSize: 9.5,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'color 0.2s, border-color 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = 'var(--paper)'
        e.currentTarget.style.borderColor = 'var(--paper-mute)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--paper-mute)'
        e.currentTarget.style.borderColor = 'var(--rule)'
      }}
    >
      重新获取 ↻
    </button>
  )
}
