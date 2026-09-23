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
  abort: () => Promise<void>
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
    } catch {
      // drop the local session even if stop fails
    }
    set((state) => resetFolder(state))
    return true
  },

  send: async (text: string) => {
    const file = get().sessionFile
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
      await window.pi.prompt(text)
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
    }
  },

  abort: async () => {
    try {
      await window.pi.abort()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  setModel: async (provider: string, modelId: string) => {
    try {
      const selection = await window.pi.setModel(provider, modelId)
      set({ ...selectionPatch(selection), error: null })
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
