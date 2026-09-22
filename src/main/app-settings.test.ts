import { SettingsManager } from '@earendil-works/pi-coding-agent'
import { describe, expect, it } from 'vitest'
import { readAppSettings, writeAppSettings } from './app-settings'

describe('app settings mapping', () => {
  it('reads defaults from an in-memory manager', () => {
    const manager = SettingsManager.inMemory({
      compaction: { enabled: false },
      images: { autoResize: false, blockImages: true },
      hideThinkingBlock: true,
    })
    const settings = readAppSettings(manager, true)
    expect(settings.compactionEnabled).toBe(false)
    expect(settings.autoResizeImages).toBe(false)
    expect(settings.blockImages).toBe(true)
    expect(settings.hideThinking).toBe(true)
    expect(settings.hasProjectSettings).toBe(true)
  })

  it('writes toggles and default model through SettingsManager', async () => {
    const manager = SettingsManager.inMemory({})
    writeAppSettings(manager, {
      compactionEnabled: false,
      retryEnabled: false,
      defaultProvider: 'anthropic',
      defaultModel: 'claude-opus-4-8',
      defaultThinkingLevel: 'high',
      modelThinkingLevels: { 'anthropic/claude-opus-4-8': 'max' },
    })
    await manager.flush()
    expect(manager.getCompactionEnabled()).toBe(false)
    expect(manager.getRetryEnabled()).toBe(false)
    expect(manager.getDefaultProvider()).toBe('anthropic')
    expect(manager.getDefaultModel()).toBe('claude-opus-4-8')
    expect(manager.getDefaultThinkingLevel()).toBe('high')
    expect(manager.getModelThinkingLevel('anthropic', 'claude-opus-4-8')).toBe('max')
  })
})
