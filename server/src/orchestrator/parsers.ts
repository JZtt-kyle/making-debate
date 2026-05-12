// Parsers for the structured-output sections that the Phase 3 / 5 / 6 prompts
// instruct each model to emit. Kept separate from prompts.ts so the prompt
// templates stay scannable and the parsers can evolve independently.
//
// Mirror this whenever you change the format spec in prompts.ts. The web
// re-implements these in web/src/lib/parseDebateOutput.ts.

import type { AnonLabel } from './anon.js'

// -------- FINAL RANKING: parser (Phase 3) ---------------------------------

// Returns ordered labels (best→worst) or null if not found.
// Turndown escapes "1." → "1\." when it appears inside a paragraph; undo that.
export function parseRanking(text: string): AnonLabel[] | null {
  const idx = text.indexOf('FINAL RANKING')
  if (idx < 0) return null
  const tail = text.slice(idx).replace(/\\\./g, '.')
  const matches = Array.from(tail.matchAll(/\d+\.\s*方案\s*([甲乙丙])/g))
  if (matches.length === 0) return null
  const labels = matches.map(m => m[1] as AnonLabel)
  const seen = new Set<AnonLabel>()
  return labels.filter(l => {
    if (seen.has(l)) return false
    seen.add(l)
    return true
  })
}

// -------- Phase 5 four-section parser -------------------------------------

// Splits the synthesizer's four-section output into (comparison + arbitration,
// finalProposal, dissent). The first two are merged so the existing storage
// schema (which has only comparison/final/dissent columns) still fits.
export function parsePhase5Output(text: string): {
  comparison: string
  finalProposal: string
  dissent: string
} {
  const sec = (head: string, nextHead: string) => {
    const re = new RegExp(`(?:##\\s*)?${head}([\\s\\S]*?)(?:##\\s*)?${nextHead}`, 'i')
    return text.match(re)?.[1]?.trim() ?? ''
  }
  const last = (head: string) => {
    const re = new RegExp(`(?:##\\s*)?${head}([\\s\\S]*?)$`, 'i')
    return text.match(re)?.[1]?.trim() ?? ''
  }

  const comparison = sec('一[、,，]\\s*观点异同对照', '二[、,，]')
  const arbitration = sec('二[、,，]\\s*关键分歧裁决', '三[、,，]')
  const finalProposal = sec('三[、,，]\\s*迭代后的综合方案', '四[、,，]')
  const dissent = last('四[、,，]\\s*少数派意见')

  const comparisonCombined = arbitration
    ? `${comparison}\n\n## 关键分歧裁决\n\n${arbitration}`
    : comparison

  return {
    comparison: comparisonCombined || text,
    finalProposal,
    dissent,
  }
}

// -------- Verdict parser (Phase 6) ----------------------------------------

export type Verdict = 'RATIFY' | 'VETO' | 'UNKNOWN'

export interface VerdictResult {
  verdict: Verdict
  reason: string
}

export function parseVerdict(text: string): VerdictResult {
  const cleaned = text.replace(/\\\./g, '.')
  const m = cleaned.match(/VERDICT:\s*(RATIFY|VETO)\s*(?:[—\-:]\s*(.+))?/i)
  if (!m) return { verdict: 'UNKNOWN', reason: '' }
  return {
    verdict: m[1].toUpperCase() as Verdict,
    reason: (m[2] ?? '').trim(),
  }
}
