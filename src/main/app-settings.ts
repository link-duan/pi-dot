import type { SettingsManager } from '@earendil-works/pi-coding-agent'
import { asThinkingLevel, type ThinkingLevel } from '@shared/protocol'
import {
  TRANSPORTS,
  type GeneralSettings,
  type ModelSettings,
  type ModelSettingsPatch,
  type TransportSetting,
  type UserPatch,
} from '@shared/settings'

type ManagedSettings = Omit<
  GeneralSettings,
  'autoGenerateSessionTitleEnabled' | 'autoGenerateSessionTitleModel'
>

export function readGeneral(manager: SettingsManager): ManagedSettings {
  const transport = manager.getTransport()
  return {
    compactionEnabled: manager.getCompactionEnabled(),
    retryEnabled: manager.getRetryEnabled(),
    enableSkillCommands: manager.getEnableSkillCommands(),
    hideThinking: manager.getHideThinkingBlock(),
    showCacheMissNotices: manager.getShowCacheMissNotices(),
    autoResizeImages: manager.getImageAutoResize(),
    blockImages: manager.getBlockImages(),
    steeringMode: manager.getSteeringMode(),
    followUpMode: manager.getFollowUpMode(),
    transport: TRANSPORTS.includes(transport as TransportSetting)
      ? (transport as TransportSetting)
      : 'auto',
    httpIdleTimeoutMs: manager.getHttpIdleTimeoutMs(),
    defaultProjectTrust: manager.getDefaultProjectTrust(),
  }
}

export function writeGeneral(manager: SettingsManager, patch: UserPatch): void {
  if (patch.compactionEnabled !== undefined) manager.setCompactionEnabled(patch.compactionEnabled)
  if (patch.autoResizeImages !== undefined) manager.setImageAutoResize(patch.autoResizeImages)
  if (patch.blockImages !== undefined) manager.setBlockImages(patch.blockImages)
  if (patch.hideThinking !== undefined) manager.setHideThinkingBlock(patch.hideThinking)
  if (patch.showCacheMissNotices !== undefined) {
    manager.setShowCacheMissNotices(patch.showCacheMissNotices)
  }
  if (patch.steeringMode !== undefined) manager.setSteeringMode(patch.steeringMode)
  if (patch.followUpMode !== undefined) manager.setFollowUpMode(patch.followUpMode)
  if (patch.transport !== undefined) manager.setTransport(patch.transport)
  if (patch.httpIdleTimeoutMs !== undefined) manager.setHttpIdleTimeoutMs(patch.httpIdleTimeoutMs)
  if (patch.retryEnabled !== undefined) manager.setRetryEnabled(patch.retryEnabled)
  if (patch.enableSkillCommands !== undefined)
    manager.setEnableSkillCommands(patch.enableSkillCommands)
  if (patch.defaultProjectTrust !== undefined)
    manager.setDefaultProjectTrust(patch.defaultProjectTrust)
}

export function readModels(manager: SettingsManager): ModelSettings {
  const enabled = manager.getEnabledModels()
  return {
    defaultProvider: manager.getDefaultProvider() ?? '',
    defaultModel: manager.getDefaultModel() ?? '',
    defaultThinkingLevel: asThinkingLevel(manager.getDefaultThinkingLevel()) ?? '',
    modelThinkingLevels: pickThinkingLevels(manager.getAllModelThinkingLevels()),
    enabledModels: enabled?.length ? [...enabled] : null,
  }
}

export function writeModels(manager: SettingsManager, patch: ModelSettingsPatch): void {
  if (patch.defaultProvider !== undefined || patch.defaultModel !== undefined) {
    const provider = patch.defaultProvider ?? manager.getDefaultProvider() ?? ''
    const model = patch.defaultModel ?? manager.getDefaultModel() ?? ''
    if (provider && model) manager.setDefaultModelAndProvider(provider, model)
  }
  if (patch.defaultThinkingLevel) manager.setDefaultThinkingLevel(patch.defaultThinkingLevel)
  if (patch.enabledModels !== undefined) {
    manager.setEnabledModels(patch.enabledModels?.length ? patch.enabledModels : undefined)
  }
  if (patch.modelThinkingLevels) {
    const current = manager.getAllModelThinkingLevels()
    for (const key of Object.keys(current)) {
      if (!(key in patch.modelThinkingLevels)) {
        const [provider, ...rest] = key.split('/')
        const modelId = rest.join('/')
        if (provider && modelId) manager.removeModelThinkingLevel(provider, modelId)
      }
    }
    for (const [key, level] of Object.entries(patch.modelThinkingLevels)) {
      const [provider, ...rest] = key.split('/')
      const modelId = rest.join('/')
      if (provider && modelId) manager.setModelThinkingLevel(provider, modelId, level)
    }
  }
}

function pickThinkingLevels(value: Record<string, ThinkingLevel>): Record<string, ThinkingLevel> {
  const next: Record<string, ThinkingLevel> = {}
  for (const [key, level] of Object.entries(value)) {
    const parsed = asThinkingLevel(level)
    if (parsed) next[key] = parsed
  }
  return next
}
