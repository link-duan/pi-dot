import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readConfig, writeConfig } from './config'

describe('pi-dot config', () => {
  let directory: string
  let path: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pi-dot-config-'))
    path = join(directory, 'nested', 'config.toml')
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('returns defaults when the file is missing', () => {
    expect(readConfig(path)).toEqual({ autoGenerateSessionTitle: { enabled: true, model: '' } })
  })

  it('falls back to defaults for invalid values', async () => {
    writeConfig({}, path)
    await writeFile(path, '[autoGenerateSessionTitle]\nenabled = "yes"\nmodel = "a/b"\n')
    expect(readConfig(path)).toEqual({ autoGenerateSessionTitle: { enabled: true, model: 'a/b' } })
  })

  it('merges patches and keeps unknown keys', async () => {
    writeConfig({}, path)
    await writeFile(path, 'other = 1\n[autoGenerateSessionTitle]\nmodel = "a/b"\n')
    writeConfig({ autoGenerateSessionTitle: { enabled: false, model: undefined } }, path)
    expect(readConfig(path)).toEqual({ autoGenerateSessionTitle: { enabled: false, model: 'a/b' } })
    expect(await readFile(path, 'utf8')).toContain('other = 1')
  })
})
