import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import {
  createAgentSessionServices,
  getAgentDir,
  ModelRuntime,
  SettingsManager,
} from '@earendil-works/pi-coding-agent'
import {
  getSupportedThinkingLevels,
  type AuthEvent,
  type AuthInteraction,
  type AuthPrompt as SdkAuthPrompt,
  type AuthType,
  type Provider,
} from '@earendil-works/pi-ai'
import { shell, type WebContents } from 'electron'
import { parseModelsFile } from '@shared/models-file'
import { parseThinkingLevels, type ModelInfo } from '@shared/protocol'
import type {
  AppSettings,
  AuthNotify,
  AuthPrompt,
  LoginEvent,
  ModelsFileResult,
  ProviderAuthMethod,
  ProviderListItem,
  SettingsCatalog,
  SettingsPatch,
} from '@shared/settings'
import { readAppSettings, writeAppSettings } from './app-settings'
import { readConfig, writeConfig } from './config'
import { IPC } from '@shared/ipc'
import { getWindows } from './window'

const MODEL_REFRESH_MS = 15_000

type LoginSession = {
  abort: AbortController
  prompts: Map<string, (value: string) => void>
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

function hasProjectSettings(cwd?: string | null): boolean {
  return !!cwd && existsSync(join(cwd, '.pi/settings.json'))
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

export async function getSettings(cwd?: string | null): Promise<AppSettings> {
  return readSettings(globalManager(), cwd)
}

function readSettings(manager: SettingsManager, cwd?: string | null): AppSettings {
  const { enabled, model } = readConfig().autoGenerateSessionTitle
  return {
    ...readAppSettings(manager, hasProjectSettings(cwd)),
    autoGenerateSessionTitleEnabled: enabled,
    autoGenerateSessionTitleModel: model,
  }
}

export async function patchSettings(
  cwd: string | null | undefined,
  patch: SettingsPatch,
): Promise<AppSettings> {
  const settings = globalManager()
  writeAppSettings(settings, patch)
  await settings.flush()
  const { autoGenerateSessionTitleEnabled: enabled, autoGenerateSessionTitleModel: model } = patch
  if (enabled !== undefined || model !== undefined) {
    writeConfig({ autoGenerateSessionTitle: { enabled, model } })
  }
  await reloadLiveSettings()
  return readSettings(settings, cwd)
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
  const items = (item: Provider, kind: ProviderListItem['kind']): ProviderListItem => {
    const status = models.getProviderAuthStatus(item.id)
    return {
      id: item.id,
      name: item.name || item.id,
      kind,
      configured: configured.has(item.id),
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
      methods: [],
    }
  })
  const builtin = providers
    .filter((item) => !customSet.has(item.id) && configured.has(item.id))
    .map((item) => items(item, 'builtin'))
  const addable = providers
    .filter((item) => !customSet.has(item.id))
    .map((item) => items(item, 'builtin'))
  const rawModels = models.getModels()
  const available: ModelInfo[] = [...rawModels]
    .sort((a, b) => {
      const aConfigured = configured.has(a.provider)
      const bConfigured = configured.has(b.provider)
      if (aConfigured && !bConfigured) return -1
      if (!aConfigured && bConfigured) return 1
      const providerCmp = a.provider.localeCompare(b.provider)
      if (providerCmp !== 0) return providerCmp
      return (a.name || a.id).localeCompare(b.name || b.id)
    })
    .map((item) => ({
      id: item.id,
      name: item.name || item.id,
      provider: item.provider,
      thinkingLevels: parseThinkingLevels(getSupportedThinkingLevels(item)),
    }))
  return { providers: [...custom, ...builtin], available, addable }
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
