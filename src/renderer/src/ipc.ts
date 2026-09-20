import { applyIncomingEvent, chatCache } from '@/session/events'
import { useChat } from '@/chat/store'
import { applyContextUsage, applyLiveSnapshot, useSession } from '@/session/store'
import type { AgentMessage, ConnectionStatus, SessionEvent } from '@shared/protocol'

let bound = false
const pendingUpdates = new Map<string, SessionEvent>()
let raf = 0
const buffer = createReplayBuffer<Queued>()

type Queued =
  | { kind: 'event'; event: SessionEvent }
  | { kind: 'status'; status: ConnectionStatus; error?: string }

export function createReplayBuffer<T>() {
  let open = false
  const items: T[] = []
  return {
    push(item: T, deliver: (item: T) => void) {
      if (open) deliver(item)
      else items.push(item)
    },
    flush(deliver: (item: T) => void) {
      open = true
      const batch = items.splice(0)
      for (const item of batch) deliver(item)
    },
  }
}

export function replayQueuedEvent(
  event: SessionEvent,
  ctx: { sessionFile: string | null; isStreaming: boolean; lastMessage?: AgentMessage },
): SessionEvent | null {
  if (event.type === 'agent_start' && event.sessionFile === ctx.sessionFile && ctx.isStreaming) {
    return null
  }
  if (
    event.type === 'message_start' &&
    event.message &&
    event.sessionFile === ctx.sessionFile &&
    ctx.lastMessage?.role === event.message.role &&
    ctx.lastMessage.timestamp === event.message.timestamp
  ) {
    return { ...event, type: 'message_update' }
  }
  return event
}

export function resolveQueuedStatus(
  status: ConnectionStatus,
  cwd: string | null,
): 'attach' | 'ignore' | 'apply' {
  if (status === 'ready' && !cwd) return 'attach'
  if (cwd && (status === 'connecting' || status === 'ready')) return 'ignore'
  return 'apply'
}

function dispatch(event: SessionEvent): void {
  if (event.type === 'context_usage') {
    applyContextUsage(event.sessionFile, event.usage)
    return
  }
  const next = applyIncomingEvent(event, {
    activeFile: useSession.getState().sessionFile,
    running: useSession.getState().runningSessionFiles,
    activeChat: useChat.getState(),
    cache: chatCache,
  })
  if (next.running !== useSession.getState().runningSessionFiles) {
    useSession.setState({ runningSessionFiles: next.running })
  }
  if (next.activeChat !== useChat.getState()) {
    useChat.setState(next.activeChat)
  }
}

function flushPending(sessionFile: string): void {
  const queued = pendingUpdates.get(sessionFile)
  if (!queued) return
  pendingUpdates.delete(sessionFile)
  dispatch(queued)
}

async function attachLiveSession(): Promise<void> {
  const snapshot = await window.pi.getSnapshot()
  if (snapshot) applyLiveSnapshot(snapshot)
}

function applyStatus(status: ConnectionStatus, error?: string): void {
  const action = resolveQueuedStatus(status, useSession.getState().cwd)
  if (action === 'attach') {
    void attachLiveSession()
    return
  }
  if (action === 'ignore') return
  useSession.setState({ connection: status, error: error ?? null })
}

function onLiveEvent(event: SessionEvent): void {
  if (event.type === 'message_update') {
    pendingUpdates.set(event.sessionFile, event)
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0
        const queued = [...pendingUpdates.values()]
        pendingUpdates.clear()
        for (const item of queued) dispatch(item)
      })
    }
    return
  }
  flushPending(event.sessionFile)
  dispatch(event)
}

function deliverQueued(item: Queued): void {
  if (item.kind === 'status') {
    applyStatus(item.status, item.error)
    return
  }
  const event = replayQueuedEvent(item.event, {
    sessionFile: useSession.getState().sessionFile,
    isStreaming: useChat.getState().isStreaming,
    lastMessage: useChat.getState().messages.at(-1),
  })
  if (event) dispatch(event)
}

export function bindIpc(): void {
  if (bound) return
  bound = true

  window.pi.onEvent((event) => {
    buffer.push({ kind: 'event', event }, (item) => {
      if (item.kind === 'event') onLiveEvent(item.event)
    })
  })

  window.pi.onStatus((status, error) => {
    buffer.push({ kind: 'status', status, error }, (item) => {
      if (item.kind === 'status') applyStatus(item.status, item.error)
    })
  })
}

export function releaseIpcQueue(): void {
  buffer.flush(deliverQueued)
}
