import { applySessionEvent, type ChatState } from '@/chat/state'
import type { SessionEvent } from '@shared/protocol'

export const chatCache = new Map<string, ChatState>()

export function clearChatCache() {
  chatCache.clear()
}

export type EventContext = {
  activeFile: string | null
  running: string[]
  activeChat: ChatState
  cache: Map<string, ChatState>
}

export function applyIncomingEvent(event: SessionEvent, ctx: EventContext): EventContext {
  const file = event.sessionFile
  let running = ctx.running
  if (event.type === 'agent_start') {
    if (!running.includes(file)) running = [...running, file]
  } else if (event.type === 'agent_end' && !event.willRetry) {
    running = running.filter((item) => item !== file)
  }

  if (file === ctx.activeFile) {
    return {
      ...ctx,
      running,
      activeChat: applySessionEvent(ctx.activeChat, event),
    }
  }

  if (event.type === 'agent_end' && !event.willRetry) {
    ctx.cache.delete(file)
    return { ...ctx, running }
  }

  const cached = ctx.cache.get(file)
  if (cached) ctx.cache.set(file, applySessionEvent(cached, event))
  return { ...ctx, running }
}

export function stashChat(
  cache: Map<string, ChatState>,
  sessionFile: string | null,
  chat: ChatState,
) {
  if (!sessionFile) return
  cache.set(sessionFile, chat)
}

export function takeChat(
  cache: Map<string, ChatState>,
  sessionFile: string | null,
): ChatState | undefined {
  if (!sessionFile) return undefined
  return cache.get(sessionFile)
}

export function dropIdleChat(cache: Map<string, ChatState>, sessionFile: string | null) {
  if (!sessionFile) return
  const cached = cache.get(sessionFile)
  if (cached && !cached.isStreaming) cache.delete(sessionFile)
}
