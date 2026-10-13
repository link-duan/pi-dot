import { modelKey, THINKING_LEVELS, type ModelInfo, type ThinkingLevel } from './protocol'

export type GeneralSection = 'agent' | 'interface' | 'network' | 'security'

export type SettingsSection = GeneralSection | 'models' | 'providers'

export type SettingsScope = 'user' | 'workspace'

export const TRANSPORTS = ['auto', 'sse', 'websocket', 'websocket-cached'] as const

export type TransportSetting = (typeof TRANSPORTS)[number]

export const DELIVERY_MODES = ['one-at-a-time', 'all'] as const

export type DeliveryMode = (typeof DELIVERY_MODES)[number]

export const PROJECT_TRUSTS = ['ask', 'always', 'never'] as const

export type ProjectTrust = (typeof PROJECT_TRUSTS)[number]

/** Settings from `settings.json` (plus the session title, from pi-dot's own config). */
export interface GeneralSettings {
  compactionEnabled: boolean
  retryEnabled: boolean
  enableSkillCommands: boolean
  autoGenerateSessionTitleEnabled: boolean
  autoGenerateSessionTitleModel: string
  hideThinking: boolean
  showCacheMissNotices: boolean
  autoResizeImages: boolean
  blockImages: boolean
  steeringMode: DeliveryMode
  followUpMode: DeliveryMode
  transport: TransportSetting
  httpIdleTimeoutMs: number
  defaultProjectTrust: ProjectTrust
}

export type GeneralKey = keyof GeneralSettings

export interface GeneralField {
  key: GeneralKey
  section: GeneralSection
  /** Where the value lives in `settings.json`; absent when it is not stored there. */
  path?: string[]
  /** Only the user (global) value takes effect. */
  userOnly?: boolean
  type: 'boolean' | 'number' | 'string' | readonly string[]
}

export const GENERAL_FIELDS: readonly GeneralField[] = [
  { key: 'compactionEnabled', section: 'agent', path: ['compaction', 'enabled'], type: 'boolean' },
  { key: 'retryEnabled', section: 'agent', path: ['retry', 'enabled'], type: 'boolean' },
  { key: 'enableSkillCommands', section: 'agent', path: ['enableSkillCommands'], type: 'boolean' },
  { key: 'autoGenerateSessionTitleEnabled', section: 'agent', userOnly: true, type: 'boolean' },
  { key: 'autoGenerateSessionTitleModel', section: 'agent', userOnly: true, type: 'string' },
  { key: 'hideThinking', section: 'interface', path: ['hideThinkingBlock'], type: 'boolean' },
  {
    key: 'showCacheMissNotices',
    section: 'interface',
    path: ['showCacheMissNotices'],
    type: 'boolean',
  },
  {
    key: 'autoResizeImages',
    section: 'interface',
    path: ['images', 'autoResize'],
    type: 'boolean',
  },
  { key: 'blockImages', section: 'interface', path: ['images', 'blockImages'], type: 'boolean' },
  { key: 'steeringMode', section: 'network', path: ['steeringMode'], type: DELIVERY_MODES },
  { key: 'followUpMode', section: 'network', path: ['followUpMode'], type: DELIVERY_MODES },
  { key: 'transport', section: 'network', path: ['transport'], type: TRANSPORTS },
  { key: 'httpIdleTimeoutMs', section: 'network', path: ['httpIdleTimeoutMs'], type: 'number' },
  {
    key: 'defaultProjectTrust',
    section: 'security',
    path: ['defaultProjectTrust'],
    userOnly: true,
    type: PROJECT_TRUSTS,
  },
]

export function generalField(key: GeneralKey): GeneralField {
  const field = GENERAL_FIELDS.find((item) => item.key === key)
  if (!field) throw new Error(`Unknown setting: ${key}`)
  return field
}

/** Whether `value` is a valid value for `field`. */
export function isFieldValue(field: GeneralField, value: unknown): boolean {
  if (typeof field.type !== 'string') return field.type.includes(value as string)
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === field.type
}

export interface WorkspaceSettings {
  path: string
  /** Untrusted folders do not load `.pi/settings.json`. */
  trusted: boolean
  overrides: Partial<GeneralSettings>
}

export interface GeneralSettingsState {
  user: GeneralSettings
  /** Null when the Window is not bound to a folder. */
  workspace: WorkspaceSettings | null
}

export type UserPatch = Partial<GeneralSettings>

/** `null` removes the workspace override. */
export type WorkspacePatch = { [K in GeneralKey]?: GeneralSettings[K] | null }

export type GeneralChange =
  | { scope: 'user'; patch: UserPatch }
  | { scope: 'workspace'; patch: WorkspacePatch }

/** The values that apply in this Window. */
export function effectiveSettings(state: GeneralSettingsState): GeneralSettings {
  if (!state.workspace?.trusted) return state.user
  return { ...state.user, ...state.workspace.overrides }
}

export interface ModelSettings {
  defaultProvider: string
  defaultModel: string
  defaultThinkingLevel: ThinkingLevel | ''
  modelThinkingLevels: Record<string, ThinkingLevel>
  /** pi's `enabledModels` patterns; null shows every model. */
  enabledModels: string[] | null
}

export type ModelSettingsPatch = Partial<ModelSettings>

type ModelRef = { provider: string; id: string; name?: string }

/** pi's exact lookup: a unique `provider/id` match wins, then a unique bare id. */
function findExact<T extends ModelRef>(reference: string, models: readonly T[]): T | undefined {
  const wanted = reference.trim().toLowerCase()
  if (!wanted) return undefined
  const canonical = models.filter((model) => modelKey(model).toLowerCase() === wanted)
  if (canonical.length) return canonical.length === 1 ? canonical[0] : undefined
  const bare = models.filter((model) => model.id.toLowerCase() === wanted)
  return bare.length === 1 ? bare[0] : undefined
}

const isAlias = (id: string): boolean => id.endsWith('-latest') || !/-\d{8}$/.test(id)

/** pi's fallback when nothing matches exactly: an id or name containing the text, aliases first. */
function findPartial<T extends ModelRef>(text: string, models: readonly T[]): T | undefined {
  const wanted = text.toLowerCase()
  const matches = models.filter(
    (model) =>
      model.id.toLowerCase().includes(wanted) || !!model.name?.toLowerCase().includes(wanted),
  )
  const aliases = matches.filter((model) => isAlias(model.id))
  const pool = aliases.length ? aliases : matches
  return [...pool].sort((a, b) => b.id.localeCompare(a.id))[0]
}

function findOne<T extends ModelRef>(pattern: string, models: readonly T[]): T | undefined {
  const found = findExact(pattern, models) ?? findPartial(pattern, models)
  if (found) return found
  const colon = pattern.lastIndexOf(':')
  return colon === -1 ? undefined : findOne(pattern.slice(0, colon), models)
}

function stripThinking(pattern: string): string {
  const colon = pattern.lastIndexOf(':')
  if (colon === -1) return pattern
  const suffix = pattern.slice(colon + 1)
  return (THINKING_LEVELS as readonly string[]).includes(suffix) ? pattern.slice(0, colon) : pattern
}

/** minimatch semantics for one path: `*` and `?` stop at `/`, `[!…]` negates a class. */
function globRegex(glob: string): RegExp {
  const source = glob
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replace(/\[!/g, '[^')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
  return new RegExp(`^${source}$`, 'i')
}

/**
 * The `provider/id` keys pi's `enabledModels` patterns select from `models`, following pi's
 * resolver: a glob matches `provider/id` or a bare id (so `deepseek/*` also selects OpenRouter's
 * `deepseek/deepseek-chat`); anything else picks one model, exactly or by substring.
 */
export function resolveEnabledModels(
  patterns: readonly string[],
  models: readonly ModelRef[],
): Set<string> {
  const keys = new Set<string>()
  for (const pattern of patterns) {
    if (!/[*?[]/.test(pattern)) {
      const model = findOne(pattern, models)
      if (model) keys.add(modelKey(model))
      continue
    }
    const glob = stripThinking(pattern)
    const exact = findExact(glob, models)
    if (exact) {
      keys.add(modelKey(exact))
      continue
    }
    const regex = globRegex(glob)
    for (const model of models) {
      if (regex.test(modelKey(model)) || regex.test(model.id)) keys.add(modelKey(model))
    }
  }
  return keys
}

/**
 * `enabledModels` patterns that show exactly `visible` among `models`, or null when every model
 * is visible. Fully visible providers collapse to `provider/*` unless that glob would also pick up
 * another provider's model; patterns matching no current model are kept.
 */
export function enabledModelPatterns(
  previous: readonly string[] | null,
  models: readonly ModelRef[],
  visible: ReadonlySet<string>,
): string[] | null {
  if (models.every((model) => visible.has(modelKey(model)))) return null
  const byProvider = new Map<string, string[]>()
  for (const model of models) {
    byProvider.set(model.provider, [...(byProvider.get(model.provider) ?? []), modelKey(model)])
  }
  const patterns = (previous ?? []).filter(
    (pattern) => resolveEnabledModels([pattern], models).size === 0,
  )
  for (const [provider, keys] of byProvider) {
    const shown = keys.filter((key) => visible.has(key))
    if (shown.length < keys.length) {
      patterns.push(...shown)
      continue
    }
    const wildcard = `${provider}/*`
    const matched = resolveEnabledModels([wildcard], models)
    if (matched.size === keys.length && keys.every((key) => matched.has(key))) {
      patterns.push(wildcard)
    } else {
      patterns.push(...keys)
    }
  }
  return patterns
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

/** Where a provider's credentials come from. */
export type AuthSource =
  | 'oauth'
  | 'api_key'
  | 'models_json'
  | 'command'
  | 'environment'
  | 'runtime'
  | 'extension'
  | 'none'

export interface ProviderListItem {
  id: string
  name: string
  kind: 'custom' | 'builtin'
  configured: boolean
  authSource: AuthSource
  /** The environment variable names, for `environment`. */
  authLabel?: string
  methods: ProviderAuthMethod[]
}

export function describeAuth(item: Pick<ProviderListItem, 'authSource' | 'authLabel'>): string {
  switch (item.authSource) {
    case 'oauth':
      return 'Signed in'
    case 'api_key':
      return 'Saved API key'
    case 'models_json':
      return 'API key in models.json'
    case 'command':
      return 'API key from a command'
    case 'environment':
      return item.authLabel ? `From ${item.authLabel}` : 'From the environment'
    case 'runtime':
      return 'Runtime API key'
    case 'extension':
      return 'Provided by an extension'
    case 'none':
      return 'No credentials'
  }
}

export type ProviderTestResult =
  | { ok: true; model: string; latencyMs: number }
  | { ok: false; model?: string; message: string }

export interface SettingsCatalog {
  providers: ProviderListItem[]
  available: ModelInfo[]
  /** Models whose provider has credentials, so they can be picked in a session. */
  usable: ModelInfo[]
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
