import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import {
  createAgentSessionServices,
  getAgentDir,
  ModelRuntime,
  SettingsManager,
} from '@earendil-works/pi-coding-agent'
import {
  clampThinkingLevel,
  getSupportedThinkingLevels,
  type Api,
  type AuthEvent,
  type Model,
  type AuthInteraction,
  type AuthPrompt as SdkAuthPrompt,
  type AuthType,
  type Provider,
} from '@earendil-works/pi-ai'
import { shell, type WebContents } from 'electron'
import { parseModelsFile } from '@shared/models-file'
import { parseThinkingLevels, type ModelInfo } from '@shared/protocol'
import type {
  AuthNotify,
  AuthSource,
  AuthPrompt,
  GeneralChange,
  GeneralSettingsState,
  LoginEvent,
  ModelSettings,
  ModelSettingsPatch,
  ModelsFileResult,
  ProviderAuthMethod,
  ProviderListItem,
  ProviderTestResult,
  SettingsCatalog,
} from '@shared/settings'
import { readGeneral, readModels, writeGeneral, writeModels } from './app-settings'
import { readWorkspaceOverrides, writeWorkspaceOverrides } from './workspace-settings'
import { builtinExtensions } from './agent-extensions'
import { readConfig, writeConfig } from './config'
import { IPC } from '@shared/ipc'
import { getWindows } from './window'

const MODEL_REFRESH_MS = 15_000
const TEST_TIMEOUT_MS = 30_000

type LoginSession = {
  abort: AbortController
  prompts: Map<string, (value: string) => void>
}

/** The folder a Window is bound to, and whether its own settings load. */
export interface SettingsFolder {
  cwd: string
  trusted: boolean
}

const logins = new Map<number, LoginSession>()
let runtimePromise: Promise<ModelRuntime> | null = null

function agentDir(): string {
  return getAgentDir()
}

function modelsPath(): string {
  return join(agentDir(), 'models.json')
}

function globalManager(): SettingsManager {
  return SettingsManager.create(homedir(), agentDir(), { projectTrusted: false })
}

async function runtime(): Promise<ModelRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      try {
        const services = await createAgentSessionServices({
          cwd: homedir(),
          agentDir: agentDir(),
          settingsManager: globalManager(),
          modelRuntimeSignal: AbortSignal.timeout(MODEL_REFRESH_MS),
          resourceLoaderOptions: { extensionFactories: builtinExtensions },
        })
        return services.modelRuntime
      } catch (error) {
        console.warn(
          'Failed to create agent session services for settings, falling back to basic runtime',
          error,
        )
        return ModelRuntime.create({
          modelsPath: modelsPath(),
          authPath: join(agentDir(), 'auth.json'),
          refreshOnCreate: false,
        })
      }
    })()
  }
  return runtimePromise
}

export function getGeneralSettings(folder: SettingsFolder | null): GeneralSettingsState {
  const { enabled, model } = readConfig().autoGenerateSessionTitle
  return {
    user: {
      ...readGeneral(globalManager()),
      autoGenerateSessionTitleEnabled: enabled,
      autoGenerateSessionTitleModel: model,
    },
    workspace: folder
      ? {
          path: folder.cwd,
          trusted: folder.trusted,
          overrides: readWorkspaceOverrides(folder.cwd),
        }
      : null,
  }
}

export async function patchGeneralSettings(
  folder: SettingsFolder | null,
  change: GeneralChange,
): Promise<GeneralSettingsState> {
  if (change.scope === 'workspace') {
    if (!folder) throw new Error('This window has no folder')
    writeWorkspaceOverrides(folder.cwd, change.patch)
  } else {
    const settings = globalManager()
    writeGeneral(settings, change.patch)
    await settings.flush()
    const { autoGenerateSessionTitleEnabled: enabled, autoGenerateSessionTitleModel: model } =
      change.patch
    if (enabled !== undefined || model !== undefined) {
      writeConfig({ autoGenerateSessionTitle: { enabled, model } })
    }
  }
  await reloadLiveSettings()
  return getGeneralSettings(folder)
}

export function getModelSettings(): ModelSettings {
  return readModels(globalManager())
}

export async function patchModelSettings(patch: ModelSettingsPatch): Promise<ModelSettings> {
  const settings = globalManager()
  writeModels(settings, patch)
  await settings.flush()
  await reloadLiveSettings()
  if (patch.enabledModels !== undefined) notifyWindows('reloadSnapshot')
  return readModels(settings)
}

export async function readModelsFileText(): Promise<ModelsFileResult> {
  try {
    const text = await readFile(modelsPath(), 'utf8')
    const parsed = parseModelsFile(text)
    return { text, error: parsed.ok ? null : parsed.error }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { text: '{\n  "providers": {}\n}\n', error: null }
    }
    return {
      text: '',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function writeModelsFileText(text: string): Promise<ModelsFileResult> {
  const parsed = parseModelsFile(text)
  if (!parsed.ok) return { text, error: parsed.error }
  await writeFile(modelsPath(), text.endsWith('\n') ? text : `${text}\n`, 'utf8')
  const current = await runtime()
  await current
    .refresh({ signal: AbortSignal.timeout(MODEL_REFRESH_MS) })
    .catch((error: unknown) => {
      console.warn('Failed to refresh model settings', error)
    })
  await refreshLiveModels()
  return { text, error: null }
}

export async function getCatalog(): Promise<SettingsCatalog> {
  const file = await readModelsFileText()
  const parsed = parseModelsFile(file.text)
  const models = await runtime()
  await models
    .refresh({ signal: AbortSignal.timeout(MODEL_REFRESH_MS) })
    .catch((error: unknown) => {
      console.warn('Failed to refresh model settings', error)
    })
  const providers = models.getProviders()
  const nativeIds = new Set(
    providers.filter((item) => models.getRegisteredNativeProvider(item.id)).map((item) => item.id),
  )
  const customIds = parsed.ok
    ? Object.keys(parsed.value.providers)
    : providers.filter((item) => !nativeIds.has(item.id)).map((item) => item.id)
  const configured = new Set(
    providers.filter((item) => models.hasConfiguredAuth(item.id)).map((item) => item.id),
  )
  const customSet = new Set(customIds)
  const stored = new Map(
    (await models.listCredentials().catch(() => [])).map((item) => [item.providerId, item.type]),
  )
  const items = (item: Provider, kind: ProviderListItem['kind']): ProviderListItem => {
    const status = models.getProviderAuthStatus(item.id)
    return {
      id: item.id,
      name: item.name || item.id,
      kind,
      configured: configured.has(item.id),
      authSource: authSource(status, stored.get(item.id)),
      authLabel: status.label,
      methods: authMethods(item),
    }
  }
  const custom: ProviderListItem[] = customIds.map((id) => {
    const provider = models.getProvider(id)
    if (provider) return items(provider, 'custom')
    const name =
      parsed.ok && typeof parsed.value.providers[id]?.name === 'string'
        ? parsed.value.providers[id].name
        : id
    return {
      id,
      name,
      kind: 'custom',
      configured: configured.has(id),
      authSource: 'none',
      methods: [],
    }
  })
  const builtin = providers
    .filter((item) => !customSet.has(item.id) && configured.has(item.id))
    .map((item) => items(item, 'builtin'))
  const addable = providers
    .filter((item) => !customSet.has(item.id))
    .map((item) => items(item, 'builtin'))
  const toInfo = (item: Model<Api>): ModelInfo => ({
    id: item.id,
    name: item.name || item.id,
    provider: item.provider,
    thinkingLevels: parseThinkingLevels(getSupportedThinkingLevels(item)),
  })
  const byName = (a: Model<Api>, b: Model<Api>) =>
    a.provider.localeCompare(b.provider) || (a.name || a.id).localeCompare(b.name || b.id)
  const available = [...models.getModels()]
    .sort((a, b) => {
      const aConfigured = configured.has(a.provider)
      const bConfigured = configured.has(b.provider)
      if (aConfigured !== bConfigured) return aConfigured ? -1 : 1
      return byName(a, b)
    })
    .map(toInfo)
  const usable = [...models.getAvailableSnapshot()].sort(byName).map(toInfo)
  return { providers: [...custom, ...builtin], available, usable, addable }
}

export async function testProvider(providerId: string): Promise<ProviderTestResult> {
  const models = await runtime()
  if (!models.hasConfiguredAuth(providerId)) {
    return { ok: false, message: 'No credentials are configured for this provider' }
  }
  const candidates = [...models.getModels(providerId)].sort((a, b) => price(a) - price(b))
  const model = candidates[0]
  if (!model) return { ok: false, message: 'Add a model to test this provider' }
  const level = clampThinkingLevel(model, 'off')
  const started = Date.now()
  try {
    const reply = await models.completeSimple(
      model,
      { messages: [{ role: 'user', content: 'Reply with OK.', timestamp: Date.now() }] },
      {
        ...(level === 'off' ? {} : { reasoning: level }),
        maxTokens: 64,
        signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
      },
    )
    if (reply.stopReason === 'error' || reply.stopReason === 'aborted') {
      return {
        ok: false,
        model: model.id,
        message: reply.errorMessage ?? `Request ${reply.stopReason}`,
      }
    }
    return { ok: true, model: model.id, latencyMs: Date.now() - started }
  } catch (error) {
    return {
      ok: false,
      model: model.id,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function price(model: Model<Api>): number {
  return (model.cost?.input ?? 0) + (model.cost?.output ?? 0)
}

function authSource(
  status: ReturnType<ModelRuntime['getProviderAuthStatus']>,
  credential: string | undefined,
): AuthSource {
  if (!status.configured) return 'none'
  switch (status.source) {
    case 'stored':
      return credential === 'oauth' ? 'oauth' : 'api_key'
    case 'runtime':
      return 'runtime'
    case 'environment':
      return 'environment'
    case 'models_json_key':
      return 'models_json'
    case 'models_json_command':
      return 'command'
    case 'fallback':
      return 'extension'
    default:
      return 'none'
  }
}

export async function startLogin(
  sender: WebContents,
  providerId: string,
  type: AuthType,
): Promise<void> {
  cancelLogin(sender.id)
  const abort = new AbortController()
  const session: LoginSession = { abort, prompts: new Map() }
  logins.set(sender.id, session)
  const models = await runtime()
  const interaction: AuthInteraction = {
    signal: abort.signal,
    notify(event) {
      const mapped = toNotify(event)
      if (mapped.type === 'auth_url') void shell.openExternal(mapped.url)
      if (mapped.type === 'device_code') void shell.openExternal(mapped.verificationUri)
      sendLogin(sender, { kind: 'notify', event: mapped })
    },
    async prompt(prompt) {
      const id = randomUUID()
      sendLogin(sender, { kind: 'prompt', id, prompt: toPrompt(prompt) })
      return new Promise<string>((resolve, reject) => {
        const fail = () => {
          session.prompts.delete(id)
          reject(new Error('Login cancelled'))
        }
        if (abort.signal.aborted) {
          fail()
          return
        }
        abort.signal.addEventListener('abort', fail, { once: true })
        session.prompts.set(id, (value) => {
          abort.signal.removeEventListener('abort', fail)
          session.prompts.delete(id)
          resolve(value)
        })
      })
    },
  }
  try {
    await models.login(providerId, type, interaction)
    await models
      .refresh({ signal: AbortSignal.timeout(MODEL_REFRESH_MS) })
      .catch((error: unknown) => {
        console.warn('Failed to refresh model settings', error)
      })
    await refreshLiveModels()
    sendLogin(sender, { kind: 'done', ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendLogin(sender, { kind: 'done', ok: false, message })
  } finally {
    if (logins.get(sender.id) === session) logins.delete(sender.id)
  }
}

export function respondLogin(senderId: number, id: string, value: string): void {
  logins.get(senderId)?.prompts.get(id)?.(value)
}

export function cancelLogin(senderId: number): void {
  const session = logins.get(senderId)
  if (!session) return
  logins.delete(senderId)
  session.abort.abort()
}

export async function logoutProvider(providerId: string): Promise<void> {
  const models = await runtime()
  await models.logout(providerId)
  await models
    .refresh({ signal: AbortSignal.timeout(MODEL_REFRESH_MS) })
    .catch((error: unknown) => {
      console.warn('Failed to refresh model settings', error)
    })
  await refreshLiveModels()
}

async function refreshLiveModels(): Promise<void> {
  await Promise.all(getWindows().map(async (hosted) => hosted.host?.refreshModels()))
  notifyWindows('reloadSnapshot')
}

async function reloadLiveSettings(): Promise<void> {
  runtimePromise = null
  await Promise.all(getWindows().map(async (hosted) => hosted.host?.reloadSettings()))
  notifyWindows('reloadSettings')
}

function notifyWindows(command: 'reloadSettings' | 'reloadSnapshot'): void {
  for (const hosted of getWindows()) hosted.send(command)
}

function authMethods(provider: Provider): ProviderAuthMethod[] {
  const methods: ProviderAuthMethod[] = []
  if (provider.auth.apiKey?.login)
    methods.push({ type: 'api_key', name: provider.auth.apiKey.name })
  if (provider.auth.oauth) {
    methods.push({
      type: 'oauth',
      name: provider.auth.oauth.name,
      loginLabel: provider.auth.oauth.loginLabel,
    })
  }
  return methods
}

function sendLogin(sender: WebContents, event: LoginEvent): void {
  if (sender.isDestroyed()) return
  sender.send(IPC.loginEvent, event)
}

function toPrompt(prompt: SdkAuthPrompt): AuthPrompt {
  if (prompt.type === 'select') {
    return { type: 'select', message: prompt.message, options: [...prompt.options] }
  }
  return { type: prompt.type, message: prompt.message, placeholder: prompt.placeholder }
}

function toNotify(event: AuthEvent): AuthNotify {
  if (event.type === 'info') {
    return {
      type: 'info',
      message: event.message,
      links: event.links?.map((link) => ({ url: link.url, label: link.label })),
    }
  }
  if (event.type === 'auth_url') {
    return { type: 'auth_url', url: event.url, instructions: event.instructions }
  }
  if (event.type === 'device_code') {
    return {
      type: 'device_code',
      userCode: event.userCode,
      verificationUri: event.verificationUri,
      intervalSeconds: event.intervalSeconds,
      expiresInSeconds: event.expiresInSeconds,
    }
  }
  return { type: 'progress', message: event.message }
}
