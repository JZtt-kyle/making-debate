// Helpers for rendering a debate topic safely. The topic field accepts
// free-form text — including pasted markdown documents thousands of chars
// long. Without truncation, that whole blob ends up as an <h1>.

/**
 * First non-empty line of `topic`, with leading markdown header / list /
 * quote markers stripped, truncated to `maxLen` chars (single ellipsis).
 * Use this anywhere a topic is shown as a one-line title.
 */
export function displayTitle(topic: string | undefined, maxLen = 120): string {
  if (!topic) return ''
  const firstLine = topic.split('\n').map(l => l.trim()).find(l => l) ?? topic.trim()
  const cleaned = firstLine
    .replace(/^#+\s*/, '')        // markdown header
    .replace(/^[*_>-]+\s*/, '')    // bullet / quote / emphasis
    .trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen) + '…'
}

/**
 * The remainder of `topic` after the first non-empty line. Empty when the
 * topic is a single line. Caller renders it as markdown (preserves any
 * structure the user pasted in).
 */
export function topicBody(topic: string | undefined): string {
  if (!topic) return ''
  const lines = topic.split('\n')
  const firstNonEmpty = lines.findIndex(l => l.trim())
  if (firstNonEmpty < 0) return ''
  return lines.slice(firstNonEmpty + 1).join('\n').trim()
}
