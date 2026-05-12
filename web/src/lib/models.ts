import type { ModelName } from '../hooks/useDebateSocket.ts'

// Single source of truth for per-model display metadata on the web side.
// Server-side model names live in server/src/browser/adapters/index.ts; that
// is the canonical set. The web's useDebateSocket.ts exports the matching
// type. If you add a model there, add it here.

export interface ModelMeta {
  /** Accent color (CSS variable name including var(...)). */
  tone: string
  /** Display name shown to readers (capitalized brand form). */
  display: string
  /** Subtitle / vendor tag (rendered in monospace small caps). */
  latin: string
}

export const MODEL_META: Record<ModelName, ModelMeta> = {
  claude:   { tone: 'var(--ochre)', display: 'Claude',   latin: 'Anthropic' },
  chatgpt:  { tone: 'var(--sage)',  display: 'ChatGPT',  latin: 'OpenAI'    },
  deepseek: { tone: 'var(--azure)', display: 'DeepSeek', latin: 'Hangzhou'  },
}

/** Short abbreviation for tight inline contexts (e.g., per-critique bullets). */
export const MODEL_ABBR: Record<ModelName, string> = {
  claude:   'CL',
  chatgpt:  'GP',
  deepseek: 'DS',
}

/** Canonical model display order, matching server's MODELS order. */
export const MODELS: ModelName[] = ['claude', 'chatgpt', 'deepseek']
