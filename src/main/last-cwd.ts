import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

function lastCwdPath(): string {
  return join(app.getPath('userData'), 'last-cwd.json')
}

export function readLastCwd(): string | null {
  try {
    const raw = JSON.parse(readFileSync(lastCwdPath(), 'utf8')) as { cwd?: string }
    return raw.cwd && existsSync(raw.cwd) ? raw.cwd : null
  } catch {
    return null
  }
}

export function writeLastCwd(cwd: string): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(lastCwdPath(), JSON.stringify({ cwd }))
}
