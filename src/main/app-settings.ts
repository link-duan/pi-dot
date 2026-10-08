import type { SettingsManager } from '@earendil-works/pi-coding-agent'
import { asThinkingLevel, type ThinkingLevel } from '@shared/protocol'
import type { AppSettings, SettingsPatch, TransportSetting } from '@shared/settings'

const TRANSPORTS: TransportSetting[] = ['sse', 'websocket', 'websocket-cached', 'auto']

export function readAppSettings(
  manager: SettingsManager,
  hasProjectSettings: boolean,
): Omit<AppSettings, 'autoGenerateSessionTitleEnabled' | 'autoGenerateSessionTitleModel'> {
  const transport = manager.getTransport()
  const thinking = manager.getDefaultThinkingLevel()
  return {
    compactionEnabled: manager.getCompactionEnabled(),
    autoResizeImages: manager.getImageAutoResize(),
    blockImages: manager.getBlockImages(),
    hideThinking: manager.getHideThinkingBlock(),
    showCacheMissNotices: manager.getShowCacheMissNotices(),
    steeringMode: manager.getSteeringMode(),
    followUpMode: manager.getFollowUpMode(),
    transport: TRANSPORTS.includes(transport as TransportSetting)
      ? (transport as TransportSetting)
      : 'auto',
    httpIdleTimeoutMs: manager.getHttpIdleTimeoutMs(),
    retryEnabled: manager.getRetryEnabled(),
    enableSkillCommands: manager.getEnableSkillCommands(),
    defaultProjectTrust: manager.getDefaultProjectTrust(),
    defaultProvider: manager.getDefaultProvider() ?? '',
    defaultModel: manager.getDefaultModel() ?? '',
    defaultThinkingLevel: asThinkingLevel(thinking) ?? '',
    modelThinkingLevels: pickThinkingLevels(manager.getAllModelThinkingLevels()),
    hasProjectSettings,
  }
}

export function writeAppSettings(manager: SettingsManager, patch: SettingsPatch): void {
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
  if (patch.defaultProvider !== undefined || patch.defaultModel !== undefined) {
    const provider = patch.defaultProvider ?? manager.getDefaultProvider() ?? ''
    const model = patch.defaultModel ?? manager.getDefaultModel() ?? ''
    if (provider && model) manager.setDefaultModelAndProvider(provider, model)
  }
  if (patch.defaultThinkingLevel !== undefined) {
    if (patch.defaultThinkingLevel) manager.setDefaultThinkingLevel(patch.defaultThinkingLevel)
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
