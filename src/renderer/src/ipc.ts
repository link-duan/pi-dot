import { applyIncomingEvent, chatCache } from '@/session/events'
import { useChat } from '@/chat/store'
import { useSession } from '@/session/store'
import type { SessionEvent } from '@shared/protocol'

let bound = false
const pendingUpdates = new Map<string, SessionEvent>()
let raf = 0

function dispatch(event: SessionEvent): void {
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

export function bindIpc(): void {
  if (bound) return
  bound = true

  window.pi.onEvent((event) => {
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
  })

  window.pi.onStatus((status, error) => {
    useSession.setState({ connection: status, error: error ?? null })
  })
}
