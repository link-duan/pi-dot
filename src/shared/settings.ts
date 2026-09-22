import type { ModelInfo, ThinkingLevel } from './protocol'

export type SettingsSection = 'general' | 'models' | 'providers'

export type TransportSetting = 'sse' | 'websocket' | 'websocket-cached' | 'auto'

export type DeliveryMode = 'all' | 'one-at-a-time'

export type ProjectTrust = 'ask' | 'always' | 'never'

export interface AppSettings {
  compactionEnabled: boolean
  autoResizeImages: boolean
  blockImages: boolean
  hideThinking: boolean
  showCacheMissNotices: boolean
  steeringMode: DeliveryMode
  followUpMode: DeliveryMode
  transport: TransportSetting
  httpIdleTimeoutMs: number
  retryEnabled: boolean
  enableSkillCommands: boolean
  defaultProjectTrust: ProjectTrust
  defaultProvider: string
  defaultModel: string
  defaultThinkingLevel: ThinkingLevel | ''
  modelThinkingLevels: Record<string, ThinkingLevel>
  hasProjectSettings: boolean
}

export type SettingsPatch = Partial<
  Omit<AppSettings, 'hasProjectSettings' | 'modelThinkingLevels'>
> & {
  modelThinkingLevels?: Record<string, ThinkingLevel>
}

export interface ModelsFileResult {
  text: string
  error: string | null
}

export interface ProviderAuthMethod {
  type: 'api_key' | 'oauth'
  name: string
  loginLabel?: string
}

export interface ProviderListItem {
  id: string
  name: string
  kind: 'custom' | 'builtin'
  configured: boolean
  authLabel?: string
  methods: ProviderAuthMethod[]
}

export interface SettingsCatalog {
  providers: ProviderListItem[]
  available: ModelInfo[]
  addable: ProviderListItem[]
}

export type AuthPrompt =
  | { type: 'text'; message: string; placeholder?: string }
  | { type: 'secret'; message: string; placeholder?: string }
  | {
      type: 'select'
      message: string
      options: Array<{ id: string; label: string; description?: string }>
    }
  | { type: 'manual_code'; message: string; placeholder?: string }

export type AuthNotify =
  | { type: 'info'; message: string; links?: Array<{ url: string; label?: string }> }
  | { type: 'auth_url'; url: string; instructions?: string }
  | {
      type: 'device_code'
      userCode: string
      verificationUri: string
      intervalSeconds?: number
      expiresInSeconds?: number
    }
  | { type: 'progress'; message: string }

export type LoginEvent =
  | { kind: 'notify'; event: AuthNotify }
  | { kind: 'prompt'; id: string; prompt: AuthPrompt }
  | { kind: 'done'; ok: boolean; message?: string }
