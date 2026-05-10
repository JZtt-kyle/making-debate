export type ModelName = 'claude' | 'chatgpt' | 'deepseek'

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
  modelName: ModelName,
  responses: { name: ModelName; content: string }[]
): string => {
  const others = responses.filter(r => r.name !== modelName)
  const othersText = others
    .map(r => `=== ${r.name} 的方案 ===\n${r.content}`)
    .join('\n\n')

  return `
【互相批评阶段】

以下是其他两个模型在本议题上的初步方案：

${othersText}

【你的任务：深度批评与补充】
作为 ${modelName}，请对上述方案进行批评性分析。要求按以下结构输出：

1. **假设/前提挑战**：指出对方方案中你认为值得质疑的假设或前提
2. **风险与盲点**：指出对方方案中你看到的具体风险、遗漏或盲点
3. **可改进方向**：基于你的视角，给出具体的改进建议

每个方案分开处理。保持建设性，目标是让最终方案更好，而非贬低对方。用中文回答。
`.trim()
}

export const PHASE4_PROMPT = (
  synthesizerName: ModelName,
  phase2Responses: { name: ModelName; content: string }[],
  phase3Responses: { name: ModelName; content: string }[]
): string => {
  const proposals = phase2Responses
    .map(r => `=== ${r.name} 的初步方案 ===\n${r.content}`)
    .join('\n\n')

  const critiques = phase3Responses
    .map(r => `=== ${r.name} 的批评 ===\n${r.content}`)
    .join('\n\n')

  return `
【综合迭代阶段】

以下是三个模型的初步方案和相互批评，请你作为综合者 (${synthesizerName}) 完成最终输出。

--- 三方初步方案 ---
${proposals}

--- 三方批评 ---
${critiques}

【你的任务】
请完成以下两部分输出：

## 一、观点异同对照

用表格或对比列表，梳理三方在以下维度上的异同：
- 核心设计理念
- 技术/实现路径
- 优先解决的问题
- 主要分歧点

## 二、迭代后的综合方案

基于上述所有观点，给出一个迭代后的综合方案。要求：
- 吸纳三方的合理之处
- 正面回应各方提出的关键风险
- 明确指出你在关键分歧点上的取舍及理由
- 方案应该比任何单一方案都更完善

用中文输出，结构清晰。
`.trim()
}
