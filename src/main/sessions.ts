import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { SessionListItem } from "@shared/protocol";

export function toSessionListItem(info: {
  id: string;
  path: string;
  modified: Date | string;
  name?: string;
  firstMessage?: string;
  messageCount: number;
}): SessionListItem {
  const name = info.name?.trim();
  const firstMessage = info.firstMessage?.trim();
  return {
    id: info.id,
    path: info.path,
    modified: info.modified instanceof Date ? info.modified.toISOString() : info.modified,
    name: name || undefined,
    firstMessage: firstMessage || undefined,
    messageCount: info.messageCount,
  };
}

export async function listProjectSessions(cwd: string): Promise<SessionListItem[]> {
  const items = await SessionManager.list(cwd);
  return items.map(toSessionListItem);
}
