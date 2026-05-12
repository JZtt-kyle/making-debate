import type { ModelName } from '../browser/adapters/index.js'
export type { ModelName }

// Anonymization labels for Phase 3 (Karpathy-style — prevents stylistic bias / sycophancy)
// Fixed order = the same proposal always maps to the same label across all evaluators.
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

export const PHASE1_PROMPT = (topic: string, principles: string, modelName: ModelName): string => `
你正在参与一场三方结构化辩论（另外两位参与者是不同的 AI 模型）。本场辩论的目的不是争输赢，而是通过不同视角的碰撞迭代出更好的方案。

【议题】
${topic}

${principles ? `【设计原则 / 约束条件】\n${principles}\n` : ''}
【你的角色】
你是 ${modelName}，请以自己独立的视角进行分析。

【本阶段任务：提出你的初步方案】
请直接给出你对此议题的初步方案。要求：
1. 先简述你对问题的核心理解（2-3句）
2. 给出你的具体方案（结构清晰，可分点）
3. 说明你方案的关键优势，以及你预见的主要风险

请用中文回答。不要先说废话，直接进入方案。
`.trim()

export const PHASE3_PROMPT = (
  anonymized: AnonProposal[]
): string => {
  const proposalsText = anonymized
    .map(p => `=== 方案${p.label} ===\n${p.content}`)
    .join('\n\n')

  const labelList = anonymized.map(p => `方案${p.label}`).join(' / ')

  return `
【互相批评与排名阶段】

以下是本议题上的三份方案。**这三份方案的作者身份已被匿名**，其中包括你自己之前提出的方案，但你不需要识别哪份是你自己的——请把它们当作三份独立的提案一视同仁地评估。

${proposalsText}

【你的任务】

第一部分：对三份方案分别进行深度批评（每份分开处理），要求按以下结构：

1. **假设/前提挑战**：指出该方案中值得质疑的假设或前提
2. **风险与盲点**：指出该方案中的具体风险、遗漏或盲点
3. **可改进方向**：给出具体的改进建议

第二部分：在评估完所有方案后，给出一个最终排名。**必须严格按以下格式输出在回答末尾**：

FINAL RANKING:
1. 方案X
2. 方案Y
3. 方案Z

（其中 X / Y / Z 是 ${labelList} 中的某一个，按你认为从最优到最次的顺序排列；每行只能是"数字. 方案+单字标签"的格式，不要加任何解释。）

保持建设性，目标是让最终方案更好。用中文回答。
`.trim()
}

// Parse "FINAL RANKING:" section. Returns ordered labels (best→worst) or null if not found.
// Turndown escapes "1." → "1\." when it appears inside a paragraph (to prevent
// re-rendering as an ordered list); we strip those escapes before matching.
export function parseRanking(text: string): AnonLabel[] | null {
  const idx = text.indexOf('FINAL RANKING')
  if (idx < 0) return null
  const tail = text.slice(idx).replace(/\\\./g, '.')
  const matches = Array.from(tail.matchAll(/\d+\.\s*方案\s*([甲乙丙])/g))
  if (matches.length === 0) return null
  const labels = matches.map(m => m[1] as AnonLabel)
  // Deduplicate while preserving order
  const seen = new Set<AnonLabel>()
  return labels.filter(l => {
    if (seen.has(l)) return false
    seen.add(l)
    return true
  })
}

// Aggregate rankings from all evaluators into average rank per proposal.
// Lower average = better. Missing rankings are skipped.
export interface AggregatedRanking {
  label: AnonLabel
  originalName: ModelName
  avgRank: number  // 1.0 = always #1; lower is better
  voteCount: number
}

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

export const PHASE4_PROMPT = (
  synthesizerName: ModelName,
  phase2Responses: { name: ModelName; content: string }[],
  phase3Responses: { name: ModelName; content: string }[],
  aggregated?: AggregatedRanking[]
): string => {
  const proposals = phase2Responses
    .map(r => `=== ${r.name} 的初步方案 ===\n${r.content}`)
    .join('\n\n')

  const critiques = phase3Responses
    .map(r => `=== ${r.name} 的批评 ===\n${r.content}`)
    .join('\n\n')

  const rankingSection = aggregated && aggregated.some(a => a.voteCount > 0)
    ? `

--- 同行匿名评分汇总（Phase 3 中三方对全部方案的盲审排名聚合，平均排名越小越好）---
${aggregated.map((a, i) =>
  `${i + 1}. ${a.originalName}（匿名标签：方案${a.label}） — 平均排名 ${a.avgRank.toFixed(2)}（来自 ${a.voteCount} 票）`
).join('\n')}

注：评分是匿名进行的，评估者不知道作者身份。这是一个客观信号，但不是定论——你应当在综合时参考它，但仍以你独立判断为准。`
    : ''

  return `
【综合迭代阶段】

以下是三个模型的初步方案和相互批评，请你作为综合者 (${synthesizerName}) 完成最终输出。

--- 三方初步方案 ---
${proposals}

--- 三方批评 ---
${critiques}${rankingSection}

【你的任务】
请完成以下两部分输出：

## 一、观点异同对照

用 Markdown 管道表格（| 列1 | 列2 | 列3 |）梳理三方在以下维度上的异同：
- 核心设计理念
- 技术/实现路径
- 优先解决的问题
- 主要分歧点

表格必须使用标准 Markdown 格式，例如：
| 维度 | Claude | ChatGPT | DeepSeek |
|------|--------|---------|----------|
| ... | ... | ... | ... |

## 二、迭代后的综合方案

基于上述所有观点，给出一个迭代后的综合方案。要求：
- 吸纳三方的合理之处
- 正面回应各方提出的关键风险
- 明确指出你在关键分歧点上的取舍及理由
- 方案应该比任何单一方案都更完善

用中文输出，结构清晰。
`.trim()
}

// Parse the Phase 4 synthesizer output into the two sections defined by PHASE4_PROMPT.
// Lives next to the prompt so format changes only touch one file.
export function parsePhase4Output(text: string): { comparison: string; finalProposal: string } {
  const comparisonMatch = text.match(/(?:##\s*)?一[、,，]观点异同对照([\s\S]*?)(?:##\s*)?二[、,，]/i)
  const proposalMatch = text.match(/(?:##\s*)?二[、,，]迭代后的综合方案([\s\S]*?)$/i)
  return {
    comparison: comparisonMatch?.[1]?.trim() ?? text,
    finalProposal: proposalMatch?.[1]?.trim() ?? '',
  }
}
