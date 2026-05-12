// Transpose Phase 3 outputs from "by reviewer" to "by target proposal".
// Phase 3 prompt enforces:
//   ### 对方案甲      (or ####)
//   - **决定性缺陷**：...
//   - **可救的洞见**：...
//   - **具体改动**：...
// All three reviewers follow the same template, which makes the transpose reliable.

export type AnonLabel = '甲' | '乙' | '丙'
export type CritiqueSection = '决定性缺陷' | '可救的洞见' | '具体改动'

export interface CritiquePoint {
  reviewer: string
  text: string
}

export type CritiquesByTarget = Record<
  AnonLabel,
  Record<CritiqueSection, CritiquePoint[]>
>

const SECTIONS: CritiqueSection[] = ['决定性缺陷', '可救的洞见', '具体改动']
const LABELS: AnonLabel[] = ['甲', '乙', '丙']

export function emptyCritiquesByTarget(): CritiquesByTarget {
  return Object.fromEntries(
    LABELS.map(l => [l, Object.fromEntries(SECTIONS.map(s => [s, [] as CritiquePoint[]]))])
  ) as CritiquesByTarget
}

export function parseCritiquesByTarget(
  phase3: { reviewer: string; content: string }[]
): CritiquesByTarget {
  const result = emptyCritiquesByTarget()

  for (const { reviewer, content } of phase3) {
    // Normalize turndown's escaped "1." in ranking section (harmless if absent).
    const text = content.replace(/\\\./g, '.')

    // Capture content between "对方案X" headers (accept H2-H4) — the trailing
    // boundary is the next 对方案 header or the FINAL RANKING block or EOF.
    const re = /#{2,4}\s*对方案\s*([甲乙丙])\s*\n([\s\S]*?)(?=#{2,4}\s*对方案\s*[甲乙丙]|FINAL RANKING|$)/g
    let m
    while ((m = re.exec(text)) !== null) {
      const label = m[1] as AnonLabel
      const block = m[2]
      for (const section of SECTIONS) {
        // Bullet with bold label: -  **决定性缺陷**：text  (allow halfwidth/fullwidth colon)
        // Content runs to next bullet, blank-line bullet, next header, or block end.
        const secRe = new RegExp(
          `\\*\\*${section}\\*\\*\\s*[：:]\\s*([\\s\\S]+?)(?=\\n\\s*-\\s*\\*\\*|\\n\\s*#{2,}|\\n\\s*---|$)`,
          'm'
        )
        const sm = block.match(secRe)
        if (sm) {
          result[label][section].push({
            reviewer,
            text: sm[1].trim().replace(/\s*\n\s*/g, ' '),
          })
        }
      }
    }
  }

  return result
}
