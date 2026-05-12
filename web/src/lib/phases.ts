// 5-phase iteration: 1 = conceptual "开题" (no model output);
// 2-6 = the five working phases (each is a DB phase id stored in messages).
export type DebatePhase = 1 | 2 | 3 | 4 | 5 | 6

// Single source of truth for phase metadata on the web side.
// Server's DB phase ids are 1-6 where 1 is conceptual "开题" with no model
// output. The five working phases (II-VI) are 2-6.

export interface PhaseMeta {
  roman: string
  label: string
  /** Short hint shown under the H2 title. */
  subtitle: string
}

export const PHASE_META: Record<DebatePhase, PhaseMeta> = {
  1: { roman: '序', label: '开题',     subtitle: '议题与设计原则' },
  2: { roman: 'I',  label: '各自方案', subtitle: '三方独立提出 · 结构化输出' },
  3: { roman: 'II', label: '匿名互评', subtitle: '盲审 · 按被评方案聚合' },
  4: { roman: 'III',label: '作者修订', subtitle: '回应批评 · 二次提案 · 坚守取舍' },
  5: { roman: 'IV', label: '综合裁决', subtitle: '异同 · 分歧 · 终稿 · 少数派' },
  6: { roman: 'V',  label: '终稿复核', subtitle: '非综合者 · 批准或否决' },
}

/** The five DB phases that hold model output (excludes the conceptual phase 1). */
export const WORKING_PHASES: DebatePhase[] = [2, 3, 4, 5, 6]

export const PHASE_MIN: DebatePhase = 2
export const PHASE_MAX: DebatePhase = 6

/** Convenience accessor with a typed return. */
export function getPhaseMeta(phase: DebatePhase): PhaseMeta {
  return PHASE_META[phase]
}
