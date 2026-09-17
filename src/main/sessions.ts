import { SessionManager } from '@earendil-works/pi-coding-agent'
import type { SessionListItem } from '@shared/protocol'

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
