import { SiteAdapter, DeepSeekConfig, ClaudeConfig } from './base.js'
import { ClaudeAdapter } from './claude.js'
import { ChatGPTAdapter } from './chatgpt.js'
import { DeepSeekAdapter } from './deepseek.js'

export type ModelConfigs = {
  claude: ClaudeConfig
  chatgpt: Record<string, never>
  deepseek: DeepSeekConfig
}

export type ModelName = keyof ModelConfigs

interface ModelEntry<N extends ModelName> {
  ctor: () => SiteAdapter
  defaultConfig: ModelConfigs[N]
}

export const ADAPTER_REGISTRY: { [N in ModelName]: ModelEntry<N> } = {
  claude:   { ctor: () => new ClaudeAdapter(),   defaultConfig: { model: 'sonnet-4-6' } },
  chatgpt:  { ctor: () => new ChatGPTAdapter(),  defaultConfig: {} },
  deepseek: { ctor: () => new DeepSeekAdapter(), defaultConfig: { mode: 'fast', deepThink: false, smartSearch: false } },
}

export const MODELS = Object.keys(ADAPTER_REGISTRY) as ModelName[]

export function makeAdapters(): Record<ModelName, SiteAdapter> {
  return Object.fromEntries(
    MODELS.map(name => [name, ADAPTER_REGISTRY[name].ctor()])
  ) as Record<ModelName, SiteAdapter>
}

export const DEFAULT_MODEL_CONFIGS: ModelConfigs = Object.fromEntries(
  MODELS.map(name => [name, ADAPTER_REGISTRY[name].defaultConfig])
) as ModelConfigs
