import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { parse, stringify } from 'smol-toml'

export interface PiDotConfig {
  autoGenerateSessionTitle: { enabled: boolean; model: string }
}

export type PiDotConfigPatch = {
  [K in keyof PiDotConfig]?: Partial<PiDotConfig[K]>
}

type Table = Record<string, unknown>

export function configPath(): string {
  return join(homedir(), '.pi-dot', 'config.toml')
}

function readRaw(path: string): Table {
  if (!existsSync(path)) return {}
  try {
    return parse(readFileSync(path, 'utf8')) as Table
  } catch (error) {
    console.error('Failed to read pi-dot config', error)
    return {}
  }
}

function table(value: unknown): Table {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Table) : {}
}

export function readConfig(path = configPath()): PiDotConfig {
  const title = table(readRaw(path).autoGenerateSessionTitle)
  return {
    autoGenerateSessionTitle: {
      enabled: typeof title.enabled === 'boolean' ? title.enabled : true,
      model: typeof title.model === 'string' ? title.model : '',
    },
  }
}

export function writeConfig(patch: PiDotConfigPatch, path = configPath()): void {
  const raw = readRaw(path)
  for (const [key, value] of Object.entries(patch)) {
    const next = table(raw[key])
    for (const [field, item] of Object.entries(value)) {
      if (item !== undefined) next[field] = item
    }
    raw[key] = next
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, stringify(raw))
}
