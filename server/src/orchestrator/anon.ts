import type { ModelName } from '../browser/adapters/index.js'

// Anonymization labels for Phase 3 (Karpathy-style — prevents stylistic bias /
// sycophancy). Fixed order = the same proposal always maps to the same label
// across all evaluators.
export const ANON_LABELS = ['甲', '乙', '丙'] as const
export type AnonLabel = typeof ANON_LABELS[number]

export interface AnonProposal {
  label: AnonLabel
  content: string
  originalName: ModelName
}

export function anonymizeProposals(
  proposals: { name: ModelName; content: string }[]
): AnonProposal[] {
  return proposals.map((p, i) => ({
    label: ANON_LABELS[i],
    content: p.content,
    originalName: p.name,
  }))
}

export interface AggregatedRanking {
  label: AnonLabel
  originalName: ModelName
  avgRank: number  // 1.0 = always #1; lower is better
  voteCount: number
}

// Aggregate rankings from all evaluators into average rank per proposal.
// Lower average = better. Missing rankings are skipped.
export function aggregateRankings(
  anonymized: AnonProposal[],
  rankings: (AnonLabel[] | null)[]
): AggregatedRanking[] {
  const totals: Record<AnonLabel, { sum: number; count: number }> = {
    甲: { sum: 0, count: 0 },
    乙: { sum: 0, count: 0 },
    丙: { sum: 0, count: 0 },
  }
  for (const r of rankings) {
    if (!r) continue
    r.forEach((label, i) => {
      totals[label].sum += i + 1
      totals[label].count += 1
    })
  }
  return anonymized
    .map(p => ({
      label: p.label,
      originalName: p.originalName,
      avgRank: totals[p.label].count > 0 ? totals[p.label].sum / totals[p.label].count : 99,
      voteCount: totals[p.label].count,
    }))
    .sort((a, b) => a.avgRank - b.avgRank)
}
