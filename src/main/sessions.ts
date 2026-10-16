import { readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { SessionManager } from '@earendil-works/pi-coding-agent'
import type { RecentProject, SessionListItem } from '@shared/protocol'

export function toSessionListItem(info: {
  id: string
  path: string
  modified: Date | string
  name?: string
  firstMessage?: string
  messageCount: number
}): SessionListItem {
  const name = info.name?.trim()
  const firstMessage = info.firstMessage?.trim()
  return {
    id: info.id,
    path: info.path,
    modified: info.modified instanceof Date ? info.modified.toISOString() : info.modified,
    name: name || undefined,
    firstMessage: firstMessage || undefined,
    messageCount: info.messageCount,
  }
}

export function withRunning(
  items: SessionListItem[],
  runningFiles: Iterable<string>,
): SessionListItem[] {
  const running = runningFiles instanceof Set ? runningFiles : new Set(runningFiles)
  if (running.size === 0) return items
  const marked = items.map((item) => (running.has(item.path) ? { ...item, running: true } : item))
  const known = new Set(marked.map((item) => item.path))
  const extra: SessionListItem[] = []
  for (const path of running) {
    if (known.has(path)) continue
    extra.push({
      id: path,
      path,
      modified: new Date().toISOString(),
      messageCount: 0,
      running: true,
    })
  }
  return extra.length > 0 ? [...extra, ...marked] : marked
}

export async function listProjectSessions(cwd: string): Promise<SessionListItem[]> {
  const items = await SessionManager.list(cwd)
  return items.map(toSessionListItem)
}

/** Where the SDK keeps a project's sessions; mirrors its unexported `getDefaultSessionDirPath`. */
export function sessionDirOf(cwd: string, agentDir: string): string {
  const safe = `--${resolve(cwd)
    .replace(/^[/\\]/, '')
    .replace(/[/\\:]/g, '-')}--`
  return join(resolve(agentDir), 'sessions', safe)
}

/**
 * A recent project with its latest session change, from file stats alone —
 * `SessionManager.list` would parse every session and create the folder when missing.
 */
export async function describeProject(cwd: string, agentDir: string): Promise<RecentProject> {
  const dir = sessionDirOf(cwd, agentDir)
  const files = (await readdir(dir).catch(() => [])).filter((file) => file.endsWith('.jsonl'))
  const times = await Promise.all(files.map((file) => stat(join(dir, file)).then((s) => s.mtimeMs)))
  return { cwd, lastActive: times.length > 0 ? new Date(Math.max(...times)).toISOString() : null }
}
