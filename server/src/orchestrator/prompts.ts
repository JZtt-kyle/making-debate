// Prompt templates for the 5-working-phase debate flow. Pure string builders;
// no parsing logic lives here (see parsers.ts) and no anon helpers either
// (see anon.ts). Output schemas are documented inline at each prompt.

import type { ModelName } from '../browser/adapters/index.js'
import type { AnonLabel, AnonProposal, AggregatedRanking } from './anon.js'
export type { ModelName }

// ---------------------------------------------------------------------------
// Phase 2 — 各自方案 (initial proposal)
// Structured headers force the model to commit to (a) problem framing, (b)
// decision points, (c) the plan itself, (d) anticipated failure modes — so
// later phases can grip on something concrete instead of free-form prose.
// ---------------------------------------------------------------------------
export const PHASE2_PROMPT = (topic: string, principles: string, modelName: ModelName): string => `
你正在参与一场五幕结构化辩论（另外两位参与者是不同的 AI 模型）。本场辩论的目的不是争输赢，而是通过观点的碰撞、批评、修订、综合，迭代出比单方更完整的方案。

【议题】
${topic}

${principles ? `【设计原则 / 约束条件】\n${principles}\n` : ''}
【你的角色】
你是 ${modelName}，请以自己独立的视角进行分析。

【本阶段任务：提出你的初步方案】
请严格按以下四个小节输出（每节都要有，标题原样保留）：

## 问题界定
两到三句话，说明你认为本议题真正要解决的核心问题是什么——你看到的本质，可能不同于字面表述。

## 关键决策点
列出 3 条以内你识别出的关键取舍 / 分叉（"是 A 还是 B"形式），并简要说明你的选择倾向。这是后续争论的锚点。

## 具体方案
结构清晰、可分点的方案主体。

## 预期失败模式
2-3 条你方案最可能在哪里出问题——主动暴露弱点比掩饰它更有价值。

请用中文回答。不要废话开场，直接进入「## 问题界定」。
`.trim()


// ---------------------------------------------------------------------------
// Phase 3 — 互评 + 排名 (continues the same conversation)
// The reviewer's own Phase 2 proposal is in conversation context, so we are
// honest with the model: one of these three is yours, evaluate fairly anyway.
// Anonymity for the *other two* is preserved by hiding the authors.
// Output schema (used by parsers.ts):
//   ### 对方案甲 (or ####)
//   - **决定性缺陷**：...
//   - **可救的洞见**：...
//   - **具体改动**：...
//   (repeat for 乙, 丙)
//   FINAL RANKING:
//   1. 方案X / 2. 方案Y / 3. 方案Z
// ---------------------------------------------------------------------------
export const PHASE3_PROMPT = (anonymized: AnonProposal[], myLabel: AnonLabel): string => {
  const proposalsText = anonymized
    .map(p => `=== 方案${p.label} ===\n${p.content}`)
    .join('\n\n')

  const labelList = anonymized.map(p => `方案${p.label}`).join(' / ')

  return `
【互评与排名阶段】

以下是同一议题上的三份方案。**其中「方案${myLabel}」是你刚才提出的方案**，另外两份分别来自另外两个 AI 模型。你的目标不是为自己辩护，而是为最终方案的质量负责——请把它们当作三份独立的提案一视同仁地评估。

${proposalsText}

【你的任务】

第一部分：对每份方案分别批评。**严格使用以下三段式结构**，每段不超过 80 字：

### 对方案甲
- **决定性缺陷**：该方案最可能让它崩溃的那一点（不是边角问题）
- **可救的洞见**：即使整体不采纳，也值得保留进综合方案的部分
- **具体改动**：一句话说明如何修复或加强

### 对方案乙
（同结构）

### 对方案丙
（同结构）

第二部分：在评估完所有方案后，给出一个最终排名。**必须严格按以下格式输出在回答末尾**：

FINAL RANKING:
1. 方案X
2. 方案Y
3. 方案Z

（其中 X / Y / Z 是 ${labelList} 中的某一个，按你认为从最优到最次的顺序排列；每行只能是"数字. 方案+单字标签"的格式，不要加任何解释。）

保持建设性，目标是让最终方案更好。用中文回答。
`.trim()
}


// ---------------------------------------------------------------------------
// Phase 4 — 作者修订 (NEW: this is where "iteration" actually happens)
// Each author sees: their own original proposal, the full set of critiques
// (which includes the critiques targeted at them, identifiable via the
// anonymous label they were assigned), and the aggregated ranking. They must
// produce a revised proposal that explicitly addresses each critique.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Phase 4 — 作者修订 (continues the same conversation)
// The author already has its own Phase 2 proposal AND its own Phase 3
// critique in context, so the prompt only feeds the OTHER reviewers'
// critiques + the aggregated ranking.
// ---------------------------------------------------------------------------
export const PHASE4_PROMPT = (
  modelName: ModelName,
  myLabel: AnonLabel,
  otherCritiques: { reviewer: ModelName; content: string }[],
  aggregated: AggregatedRanking[],
): string => {
  const myRank = aggregated.find(a => a.label === myLabel)
  const rankLine = myRank && myRank.voteCount > 0
    ? `你的方案（标签「方案${myLabel}」）平均排名 ${myRank.avgRank.toFixed(2)}（共 ${myRank.voteCount} 票），在三份方案中位列第 ${aggregated.findIndex(a => a.label === myLabel) + 1}。`
    : `（本轮排名信号缺失）`

  const critiquesText = otherCritiques.length > 0
    ? otherCritiques
        .map(c => `--- 来自另一位评审者 ${c.reviewer} 的意见 ---\n${c.content}`)
        .join('\n\n')
    : '（其余评审者意见缺失）'

  return `
【作者修订阶段】

你是 ${modelName}。你刚才在上一条消息中已经评审过三份方案（其中「方案${myLabel}」是你自己的初步方案）。下面是另外两位评审者对全部三份方案的批评，请重点关注其中针对「方案${myLabel}」（也就是你）的部分。

【另外两位评审者的意见】
${critiquesText}

【三方排名汇总】
${rankLine}

【你的任务】
请严格按以下三个小节输出：

## 一、对针对我的批评的逐条回应
把所有"针对方案${myLabel}"的"决定性缺陷"和"具体改动"提炼出来（包括你自己上一条消息里给方案${myLabel}写下的批评），逐条给出你的回应。每条 ≤ 50 字，明确分类为下列之一：
- **接受** — 我同意，将在修订中改正
- **反驳** — 这条批评建立在错误前提上，理由是…
- **反提案** — 批评指出了真实问题但建议的方向不对，我提议改为…

格式示例：
> 「方案应增加 X」（接受 / 反驳 / 反提案）：……

## 二、修订后的方案
基于上面的回应，给出修订稿。保留你原方案中未被有效挑战的部分；改写被批评命中的部分；可以引入其他两份方案里你认为正确的洞见。结构清晰、可分点。

## 三、坚守的取舍
列出 1-3 条「即使被批评仍坚持」的决策，并给出你坚持的理由。这是综合者需要看到的"非妥协点"。

用中文回答。不要废话，直接从「## 一、对针对我的批评的逐条回应」开始。
`.trim()
}


// ---------------------------------------------------------------------------
// Phase 5 — 综合 + 裁决 + 少数派意见 (synthesizer only, on REVISED proposals)
// Output schema (used by parsers.ts):
//   ## 一、观点异同对照     (markdown pipe table)
//   ## 二、关键分歧裁决     (2-4 disputes, each with 分类/裁决/理由)
//   ## 三、迭代后的综合方案 (with end-of-section principle self-check)
//   ## 四、少数派意见       (1-3 unincorporated minority views)
// ---------------------------------------------------------------------------
export const PHASE5_PROMPT = (
  synthesizerName: ModelName,
  topic: string,
  principles: string,
  otherRevisions: { name: ModelName; content: string }[],
  otherCritiques: { reviewer: ModelName; content: string }[],
  aggregated: AggregatedRanking[],
): string => {
  const revisions = otherRevisions
    .map(r => `=== ${r.name} 的修订稿 ===\n${r.content}`)
    .join('\n\n')

  const critiques = otherCritiques.length > 0
    ? otherCritiques
        .map(c => `=== 评审者 ${c.reviewer} 的意见 ===\n${c.content}`)
        .join('\n\n')
    : '（其余评审者意见缺失）'

  const rankingSection = aggregated.some(a => a.voteCount > 0)
    ? `

【上一轮匿名排名汇总（平均排名越小越好）】
${aggregated.map((a, i) =>
  `${i + 1}. ${a.originalName}（匿名标签：方案${a.label}） — 平均排名 ${a.avgRank.toFixed(2)}（来自 ${a.voteCount} 票）`
).join('\n')}

注：此排名基于初步方案的盲审，修订稿可能已经显著改善；请把它作为参考信号，不要作为定论。`
    : ''

  const principlesBlock = principles
    ? `\n【原始设计原则 / 约束】\n${principles}\n`
    : ''

  return `
【综合迭代阶段】

你是综合者 ${synthesizerName}。三方已经各自经历了「提案 → 互评 → 修订」三步——**你自己的提案、批评、修订稿都在上文中**。下面是另外两位的修订稿、批评意见、和排名汇总。请把它们综合成一份比任何单一方案都更完整的终稿。

【议题】
${topic}
${principlesBlock}
【另外两位的修订稿】
${revisions}

【另外两位的批评意见（供你识别仍未被妥善回应的关键风险）】
${critiques}${rankingSection}

【你的任务】
请严格按以下四个小节输出（标题原样保留）：

## 一、观点异同对照

用 Markdown 管道表格梳理三份**修订稿**在以下维度上的异同：
- 核心设计理念
- 技术 / 实现路径
- 优先解决的问题
- 主要分歧点

表格必须使用标准 Markdown 格式：
| 维度 | Claude | ChatGPT | DeepSeek |
|------|--------|---------|----------|
| ... | ... | ... | ... |

## 二、关键分歧裁决

列出修订之后仍然存在的核心分歧（2-4 条）。对每条：
- **分歧描述**：是什么分歧、各方立场是什么
- **分类**：事实性 / 价值观 / 策略 / 范围 中的一种
- **你的裁决**：你站在哪一方，或给出第三方案
- **理由**：为什么这样裁决

## 三、迭代后的综合方案

基于上述所有信息，给出综合方案。要求：
- 吸纳三方修订稿中的合理之处
- 显式回应初步盲审中提出但未被任一作者妥善修复的关键风险（如果有）
- 在结尾用一个清单形式自检：${principles ? '对每一条「原始设计原则」给出是否满足 + 一句话说明' : '对议题中提到的每一个核心要求，给出是否满足 + 一句话说明'}

## 四、少数派意见

列出 1-3 条「在综合方案中没有采纳，但仍值得保留」的反对意见。每条用一段简短说明：观点本身、提出者（如果有迹可循）、为什么值得保留、在什么情况下应当重新考虑。

用中文输出。结构清晰，不要废话开场。
`.trim()
}


// ---------------------------------------------------------------------------
// Phase 6 — 终稿复核 (ratify / veto, parallel by non-synthesizers)
// A lightweight check: each non-synthesizer reads the final proposal + dissent
// and either RATIFIES or VETOES with a specific clause. Cheap: ≤200 words.
// Output schema (used by parsers.ts):
//   <body up to 200 chars>
//   VERDICT: RATIFY  -or-  VERDICT: VETO — <reason>
// ---------------------------------------------------------------------------
export const PHASE6_PROMPT = (
  modelName: ModelName,
  synthesizerName: ModelName,
  comparison: string,
  finalProposal: string,
  dissent: string,
): string => {
  const dissentBlock = dissent
    ? `\n【综合者保留的少数派意见】\n${dissent}\n`
    : ''

  return `
【终稿复核阶段】

你是 ${modelName}。综合者 ${synthesizerName} 刚刚整合出了终稿，请你以独立审稿人的身份给出快速判断。注意：本环节不是再一次完整批评，而是 ≤200 字的复核——只在你**确实发现了不该被忽略的问题**时才 VETO。

【综合者输出的观点异同对照 + 分歧裁决】
${comparison}

【综合者输出的迭代后综合方案】
${finalProposal}
${dissentBlock}
【你的任务】
用 ≤200 字给出审稿意见，包含：
- 你是否支持本终稿
- 如果 VETO，**必须**给出具体条款（例如「方案中第 X 条没有回应批评里指出的 Y 风险」）；不接受"我觉得不好"这种模糊措辞

**最后一行必须严格是以下两种之一**：

VERDICT: RATIFY

或

VERDICT: VETO — <一句话说明被否决的具体条款>

用中文回答。
`.trim()
}
