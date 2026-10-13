import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  readWorkspaceOverrides,
  workspaceSettingsPath,
  writeWorkspaceOverrides,
} from './workspace-settings'

describe('workspace settings', () => {
  let cwd: string

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'pi-dot-workspace-'))
  })

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true })
  })

  async function seed(text: string): Promise<void> {
    await mkdir(join(cwd, '.pi'), { recursive: true })
    await writeFile(workspaceSettingsPath(cwd), text)
  }

  it('reads nothing when the file is missing', () => {
    expect(readWorkspaceOverrides(cwd)).toEqual({})
  })

  it('maps nested keys and skips user-only and invalid values', async () => {
    await seed(
      JSON.stringify({
        compaction: { enabled: false },
        images: { blockImages: true },
        hideThinkingBlock: true,
        transport: 'carrier-pigeon',
        defaultProjectTrust: 'always',
        defaultModel: 'x',
      }),
    )
    expect(readWorkspaceOverrides(cwd)).toEqual({
      compactionEnabled: false,
      blockImages: true,
      hideThinking: true,
    })
  })

  it('creates the file and nested objects', async () => {
    writeWorkspaceOverrides(cwd, { retryEnabled: false, steeringMode: 'all' })
    const json = JSON.parse(await readFile(workspaceSettingsPath(cwd), 'utf8'))
    expect(json).toEqual({ retry: { enabled: false }, steeringMode: 'all' })
  })

  it('keeps comments and unrelated keys', async () => {
    await seed('{\n  // project packages\n  "packages": ["a"],\n  "hideThinkingBlock": false\n}\n')
    writeWorkspaceOverrides(cwd, { hideThinking: true })
    const text = await readFile(workspaceSettingsPath(cwd), 'utf8')
    expect(text).toContain('// project packages')
    expect(text).toContain('"packages": ["a"]')
    expect(text).toContain('"hideThinkingBlock": true')
  })

  it('removes an override and the parent it leaves empty', async () => {
    await seed(
      JSON.stringify({ images: { autoResize: false }, retry: { enabled: false, maxRetries: 2 } }),
    )
    writeWorkspaceOverrides(cwd, { autoResizeImages: null, retryEnabled: null })
    const json = JSON.parse(await readFile(workspaceSettingsPath(cwd), 'utf8'))
    expect(json).toEqual({ retry: { maxRetries: 2 } })
  })

  it('rejects user-only settings and invalid values', () => {
    expect(() => writeWorkspaceOverrides(cwd, { defaultProjectTrust: 'always' })).toThrow()
    expect(() => writeWorkspaceOverrides(cwd, { autoGenerateSessionTitleEnabled: false })).toThrow()
    expect(() => writeWorkspaceOverrides(cwd, { transport: 'x' as unknown as 'sse' })).toThrow()
  })
})
