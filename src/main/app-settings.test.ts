import { SettingsManager } from '@earendil-works/pi-coding-agent'
import { describe, expect, it } from 'vitest'
import { readGeneral, readModels, writeGeneral, writeModels } from './app-settings'

describe('app settings mapping', () => {
  it('reads general settings from an in-memory manager', () => {
    const manager = SettingsManager.inMemory({
      compaction: { enabled: false },
      images: { autoResize: false, blockImages: true },
      hideThinkingBlock: true,
    })
    const settings = readGeneral(manager)
    expect(settings.compactionEnabled).toBe(false)
    expect(settings.autoResizeImages).toBe(false)
    expect(settings.blockImages).toBe(true)
    expect(settings.hideThinking).toBe(true)
  })

  it('writes general toggles through SettingsManager', async () => {
    const manager = SettingsManager.inMemory({})
    writeGeneral(manager, { compactionEnabled: false, retryEnabled: false })
    await manager.flush()
    expect(manager.getCompactionEnabled()).toBe(false)
    expect(manager.getRetryEnabled()).toBe(false)
  })

  it('reads and writes model settings', async () => {
    const manager = SettingsManager.inMemory({})
    writeModels(manager, {
      defaultProvider: 'anthropic',
      defaultModel: 'claude-opus-4-8',
      defaultThinkingLevel: 'high',
      modelThinkingLevels: { 'anthropic/claude-opus-4-8': 'max' },
      enabledModels: ['anthropic/*'],
    })
    await manager.flush()
    expect(readModels(manager)).toEqual({
      defaultProvider: 'anthropic',
      defaultModel: 'claude-opus-4-8',
      defaultThinkingLevel: 'high',
      modelThinkingLevels: { 'anthropic/claude-opus-4-8': 'max' },
      enabledModels: ['anthropic/*'],
    })
    writeModels(manager, { enabledModels: null })
    expect(readModels(manager).enabledModels).toBeNull()
  })
})
