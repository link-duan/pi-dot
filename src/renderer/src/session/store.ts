import type { ChatState } from '@/chat/state'
import type {
  AgentMessage,
  ModelSelection,
  SessionListItem,
  SessionSnapshot,
  ThinkingLevel,
} from '@shared/protocol'
import { SerialQueue } from '@shared/queue'
import { create } from 'zustand'
import {
  activeChat,
  applySnapshot,
  createWindowState,
  parkActive,
  patchChat,
  resetFolder,
  type WindowState,
} from './state'

interface SessionStore extends WindowState {
  openFolder: () => Promise<boolean>
  openCwd: (cwd: string) => Promise<boolean>
  leave: () => Promise<boolean>
  send: (text: string) => Promise<void>
  steer: (text: string) => Promise<void>
  removeSteering: (index: number) => Promise<void>
  followUp: (text: string) => Promise<void>
  setFollowUpQueue: (messages: string[]) => Promise<void>
  editFollowUp: (index: number, newText: string) => Promise<void>
  deleteFollowUp: (index: number) => Promise<void>
  moveFollowUp: (fromIndex: number, toIndex: number) => Promise<void>
  promoteFollowUpToSteer: (index: number) => Promise<void>
  clearQueue: () => Promise<void>
  clearSteeringQueue: () => Promise<void>
  abort: () => Promise<void>
  compact: () => Promise<void>
  setModel: (provider: string, modelId: string) => Promise<void>
  setThinkingLevel: (level: ThinkingLevel) => Promise<void>
  listSessions: () => Promise<SessionListItem[]>
  switchSession: (sessionPath: string) => Promise<void>
  newSession: () => Promise<void>
  requestComposerFocus: () => void
}

function selectionPatch(selection: ModelSelection) {
  return {
    model: selection.model,
    thinkingLevel: selection.thinkingLevel,
    thinkingLevels: selection.thinkingLevels,
  }
}

export function applyLiveSnapshot(snapshot: SessionSnapshot, chat?: ChatState) {
  useSession.setState((state) => applySnapshot(state, snapshot, chat))
}

const queueOperations = new Map<string, SerialQueue>()

function enqueueQueueOperation(file: string, operation: () => Promise<void>): Promise<void> {
  const queue = queueOperations.get(file) ?? new SerialQueue()
  queueOperations.set(file, queue)
  return queue.enqueue(operation)
}

function sameQueue(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index])
}

export const useSession = create<SessionStore>((set, get) => ({
  ...createWindowState(),

  openFolder: async () => {
    const cwd = await window.pi.chooseFolder()
    if (!cwd) return false
    return get().openCwd(cwd)
  },

  openCwd: async (cwd: string) => {
    const previous = { connection: get().connection, error: get().error }
    set({ connection: 'connecting', error: null })
    try {
      const result = await window.pi.start(cwd)
      if (result.kind !== 'started') {
        set(previous)
        return false
      }
      set((state) => applySnapshot({ ...state, chats: {} }, result.snapshot))
      return true
    } catch (error) {
      set({
        cwd,
        connection: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
      return true
    }
  },

  leave: async () => {
    try {
      const result = await window.pi.stop()
      if (result.cancelled) return false
    } catch (error) {
      console.error('Failed to stop session', error)
    }
    set((state) => resetFolder(state))
    return true
  },

  send: async (text: string) => {
    const file = get().sessionFile
    if (!file) return
    const optimisticMessage: AgentMessage = {
      role: 'user',
      content: [{ type: 'text', text }],
      timestamp: Date.now(),
    }
    set((state) => {
      const running =
        file && !state.running.includes(file) ? [...state.running, file] : state.running
      const currentChat = file ? state.chats[file] : undefined
      const next = file
        ? patchChat(state, file, {
            isStreaming: true,
            turnActive: false,
            turnStartedAt: Date.now(),
            turnEndedAt: null,
            messages: [...(currentChat?.messages ?? []), optimisticMessage],
          })
        : state
      return { ...next, error: null, running }
    })
    try {
      await window.pi.prompt(text, file)
    } catch (error) {
      set((state) => {
        let next = {
          ...state,
          error: error instanceof Error ? error.message : String(error),
          running: file ? state.running.filter((item) => item !== file) : state.running,
        }
        if (file) next = patchChat(next, file, { isStreaming: false, turnEndedAt: Date.now() })
        return next
      })
      throw error
    }
  },

  steer: async (text: string) => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]?.steeringQueue ?? []
      try {
        await window.pi.steer(text, file)
        const current = get().chats[file]?.steeringQueue
        if (current && sameQueue(current, before)) {
          set((state) => patchChat(state, file, { steeringQueue: [...before, text] }))
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  removeSteering: async (index: number) => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]?.steeringQueue ?? []
      const next = before.filter((_, itemIndex) => itemIndex !== index)
      if (sameQueue(before, next)) return
      try {
        await window.pi.removeSteering(index, file)
        const current = get().chats[file]?.steeringQueue
        if (current && sameQueue(current, before)) {
          set((state) => patchChat(state, file, { steeringQueue: next }))
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  followUp: async (text: string) => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]?.followUpQueue ?? []
      try {
        await window.pi.followUp(text, file)
        const current = get().chats[file]?.followUpQueue
        if (current && sameQueue(current, before)) {
          set((state) => patchChat(state, file, { followUpQueue: [...before, text] }))
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  setFollowUpQueue: async (messages: string[]) => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]?.followUpQueue ?? []
      try {
        await window.pi.setFollowUpQueue(messages, file)
        const current = get().chats[file]?.followUpQueue
        if (current && sameQueue(current, before)) {
          set((state) => patchChat(state, file, { followUpQueue: [...messages] }))
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  editFollowUp: async (index: number, newText: string) => {
    const file = get().sessionFile
    if (!file) return
    const chat = get().chats[file]
    if (!chat || chat.followUpQueue[index] === undefined) return
    const next = [...chat.followUpQueue]
    next[index] = newText
    await get().setFollowUpQueue(next)
  },

  deleteFollowUp: async (index: number) => {
    const file = get().sessionFile
    if (!file) return
    const chat = get().chats[file]
    if (!chat) return
    const next = chat.followUpQueue.filter((_, i) => i !== index)
    await get().setFollowUpQueue(next)
  },

  moveFollowUp: async (fromIndex: number, toIndex: number) => {
    const file = get().sessionFile
    if (!file) return
    const chat = get().chats[file]
    if (!chat) return
    if (toIndex < 0 || toIndex >= chat.followUpQueue.length) return
    const next = [...chat.followUpQueue]
    const [removed] = next.splice(fromIndex, 1)
    if (removed === undefined) return
    next.splice(toIndex, 0, removed)
    await get().setFollowUpQueue(next)
  },

  promoteFollowUpToSteer: async (index: number) => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]?.followUpQueue ?? []
      const beforeSteering = get().chats[file]?.steeringQueue ?? []
      const text = before[index]
      const next = before.filter((_, itemIndex) => itemIndex !== index)
      if (text === undefined || sameQueue(before, next)) return
      try {
        await window.pi.promoteFollowUp(index, file)
        const current = get().chats[file]
        if (current && sameQueue(current.followUpQueue, before)) {
          set((state) =>
            patchChat(state, file, {
              followUpQueue: next,
              ...(sameQueue(current.steeringQueue, beforeSteering)
                ? { steeringQueue: [...beforeSteering, text] }
                : {}),
            }),
          )
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  clearQueue: async () => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]
      if (!before) return
      try {
        await window.pi.clearQueue(file)
        const current = get().chats[file]
        if (
          current &&
          sameQueue(current.steeringQueue, before.steeringQueue) &&
          sameQueue(current.followUpQueue, before.followUpQueue)
        ) {
          set((state) =>
            patchChat(state, file, {
              steeringQueue: [],
              followUpQueue: [],
            }),
          )
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  clearSteeringQueue: async () => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]?.steeringQueue ?? []
      try {
        await window.pi.clearSteeringQueue(file)
        const current = get().chats[file]?.steeringQueue
        if (current && sameQueue(current, before)) {
          set((state) => patchChat(state, file, { steeringQueue: [] }))
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  abort: async () => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]
      if (!before) return
      try {
        await window.pi.abort(file)
        const current = get().chats[file]
        if (
          current &&
          sameQueue(current.steeringQueue, before.steeringQueue) &&
          sameQueue(current.followUpQueue, before.followUpQueue)
        ) {
          set((state) =>
            patchChat(state, file, {
              steeringQueue: [],
              followUpQueue: [],
            }),
          )
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  setModel: async (provider: string, modelId: string) => {
    try {
      const selection = await window.pi.setModel(provider, modelId)
      set({ ...selectionPatch(selection), error: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  compact: async () => {
    const file = get().sessionFile
    if (!file) return
    try {
      await window.pi.compact(file)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  setThinkingLevel: async (level: ThinkingLevel) => {
    try {
      const selection = await window.pi.setThinkingLevel(level)
      set({ ...selectionPatch(selection), error: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  listSessions: async () => {
    const cwd = get().cwd
    if (!cwd) return []
    const items = await window.pi.listSessions(cwd)
    const running = get().running
    return items.map((item) => (running.includes(item.path) ? { ...item, running: true } : item))
  },

  switchSession: async (sessionPath: string) => {
    if (get().sessionFile === sessionPath) return
    try {
      await activateSession(() => window.pi.switchSession(sessionPath))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  newSession: async () => {
    try {
      await activateSession(() => window.pi.newSession())
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  requestComposerFocus: () => set((state) => ({ focusNonce: state.focusNonce + 1 })),
}))

export function useChat(): ChatState
export function useChat<T>(selector: (chat: ChatState) => T): T
export function useChat<T>(selector?: (chat: ChatState) => T): ChatState | T {
  return useSession((state) => (selector ? selector(activeChat(state)) : activeChat(state)))
}

const activating = new SerialQueue()

async function activateSession(load: () => Promise<SessionSnapshot>) {
  await activating.enqueue(() => swapSession(load))
}

async function swapSession(load: () => Promise<SessionSnapshot>) {
  const snapshot = await load()
  useSession.setState((state) => {
    const nextFile = snapshot.state.sessionFile ?? null
    const cached = nextFile ? state.chats[nextFile] : undefined
    return applySnapshot(parkActive(state), snapshot, cached)
  })
}
