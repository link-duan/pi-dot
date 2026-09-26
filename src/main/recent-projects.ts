import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

const MAX_RECENT_PROJECTS = 30

function recentProjectsPath(): string {
  return join(app.getPath('userData'), 'recent-projects.json')
}

function legacyLastCwdPath(): string {
  return join(app.getPath('userData'), 'last-cwd.json')
}

export function readRecentProjects(): string[] {
  try {
    const filePath = recentProjectsPath()
    if (existsSync(filePath)) {
      const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown
      const list = Array.isArray(raw)
        ? raw
        : raw &&
            typeof raw === 'object' &&
            'recent' in raw &&
            Array.isArray((raw as { recent: unknown }).recent)
          ? (raw as { recent: unknown[] }).recent
          : []
      return list.filter((item): item is string => typeof item === 'string' && existsSync(item))
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn('Failed to read recent projects', error)
    }
  }

  try {
    const legacyPath = legacyLastCwdPath()
    if (existsSync(legacyPath)) {
      const raw = JSON.parse(readFileSync(legacyPath, 'utf8')) as { cwd?: string }
      if (raw.cwd && existsSync(raw.cwd)) {
        return [raw.cwd]
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn('Failed to read legacy recent project', error)
    }
  }

  return []
}

export function writeRecentProjects(recent: string[]): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(recentProjectsPath(), JSON.stringify({ recent }, null, 2))
}

export function addRecentProject(cwd: string): void {
  if (!existsSync(cwd)) return
  const current = readRecentProjects()
  const next = [cwd, ...current.filter((item) => item !== cwd)].slice(0, MAX_RECENT_PROJECTS)
  writeRecentProjects(next)
}

export function removeRecentProject(cwd: string): void {
  const current = readRecentProjects()
  const next = current.filter((item) => item !== cwd)
  writeRecentProjects(next)
}
