import { createChatState, hydrateMessages, type ChatState } from '@/chat/state'
import { useChat } from '@/chat/store'
import type {
  ConnectionStatus,
  ContextUsage,
  ModelInfo,
  ModelSelection,
  SessionListItem,
  SessionSnapshot,
  SkillInfo,
  ThinkingLevel,
} from '@shared/protocol'
import { create } from 'zustand'
import { chatCache, clearChatCache, dropIdleChat, stashChat, takeChat } from './events'

interface SessionStore {
  lastCwd: string | null
  cwd: string | null
  sessionId: string | null
  sessionFile: string | null
  connection: ConnectionStatus
  error: string | null
  runningSessionFiles: string[]
  models: ModelInfo[]
  model: ModelInfo | null
  thinkingLevel: ThinkingLevel
  thinkingLevels: ThinkingLevel[]
  skills: SkillInfo[]
  contextUsage: ContextUsage | null
  openFolder: () => Promise<void>
  openCwd: (cwd: string) => Promise<void>
  leave: () => Promise<void>
  send: (text: string) => Promise<void>
  abort: () => Promise<void>
  setModel: (provider: string, modelId: string) => Promise<void>
  setThinkingLevel: (level: ThinkingLevel) => Promise<void>
  listSessions: () => Promise<SessionListItem[]>
  switchSession: (sessionPath: string) => Promise<void>
  newSession: () => Promise<void>
}

function selectionPatch(selection: ModelSelection) {
  return {
    model: selection.model,
    thinkingLevel: selection.thinkingLevel,
    thinkingLevels: selection.thinkingLevels,
  }
}

function snapshotPatch(snapshot: SessionSnapshot) {
  return {
    cwd: snapshot.cwd,
    lastCwd: snapshot.cwd,
    sessionId: snapshot.state.sessionId ?? null,
    sessionFile: snapshot.state.sessionFile ?? null,
    connection: 'ready' as const,
    error:
      snapshot.models.length === 0
        ? 'No models available. Run pi in a terminal and complete /login first.'
        : null,
    models: snapshot.models,
    model: snapshot.state.model ?? snapshot.models[0] ?? null,
    thinkingLevel: snapshot.state.thinkingLevel,
    thinkingLevels: snapshot.thinkingLevels,
    runningSessionFiles: snapshot.runningSessionFiles,
    skills: snapshot.skills,
    contextUsage: snapshot.contextUsage ?? null,
  }
}

export function applyContextUsage(sessionFile: string, usage: ContextUsage | null) {
  if (useSession.getState().sessionFile !== sessionFile) return
  useSession.setState({ contextUsage: usage })
}

export function applyLiveSnapshot(snapshot: SessionSnapshot, chat?: ChatState) {
  useSession.setState(snapshotPatch(snapshot))
  useChat.setState(
    chat ??
      hydrateMessages(snapshot.messages, {
        isStreaming: snapshot.state.isStreaming,
        persistedAt: snapshot.messagePersistedAt,
      }),
  )
}

export const useSession = create<SessionStore>((set, get) => ({
  lastCwd: null,
  cwd: null,
  sessionId: null,
  sessionFile: null,
  connection: 'disconnected',
  error: null,
  runningSessionFiles: [],
  models: [],
  model: null,
  thinkingLevel: 'off',
  thinkingLevels: [],
  skills: [],
  contextUsage: null,

  openFolder: async () => {
    const cwd = await window.pi.chooseFolder()
    if (cwd) await get().openCwd(cwd)
  },

  openCwd: async (cwd: string) => {
    clearChatCache()
    set({ connection: 'connecting', error: null, cwd, runningSessionFiles: [], contextUsage: null })
    useChat.setState(createChatState())
    try {
      applyLiveSnapshot(await window.pi.start(cwd))
    } catch (error) {
      set({
        connection: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  leave: async () => {
    try {
      await window.pi.stop()
    } catch {
      // drop the local session even if stop fails
    }
    clearChatCache()
    set({
      cwd: null,
      sessionId: null,
      sessionFile: null,
      connection: 'disconnected',
      error: null,
      runningSessionFiles: [],
      models: [],
      model: null,
      thinkingLevel: 'off',
      thinkingLevels: [],
      skills: [],
      contextUsage: null,
    })
    useChat.setState(createChatState())
  },

  send: async (text: string) => {
    const file = get().sessionFile
    set((state) => ({
      error: null,
      runningSessionFiles:
        file && !state.runningSessionFiles.includes(file)
          ? [...state.runningSessionFiles, file]
          : state.runningSessionFiles,
    }))
    useChat.setState({
      isStreaming: true,
      turnActive: false,
      turnStartedAt: Date.now(),
      turnEndedAt: null,
    })
    try {
      await window.pi.prompt(text)
    } catch (error) {
      set((state) => ({
        error: error instanceof Error ? error.message : String(error),
        runningSessionFiles: file
          ? state.runningSessionFiles.filter((item) => item !== file)
          : state.runningSessionFiles,
      }))
      if (get().sessionFile === file) {
        useChat.setState({ isStreaming: false, turnEndedAt: Date.now() })
      } else if (file) {
        const cached = chatCache.get(file)
        if (cached) chatCache.set(file, { ...cached, isStreaming: false, turnEndedAt: Date.now() })
      }
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
    const known = new Set(items.map((item) => item.path))
    const extra = get()
      .runningSessionFiles.filter((path) => !known.has(path))
      .map((path) => ({
        id: path,
        path,
        modified: new Date().toISOString(),
        messageCount: 0,
        running: true as const,
      }))
    const running = new Set(get().runningSessionFiles)
    return [...extra, ...items].map((item) =>
      running.has(item.path) || item.running ? { ...item, running: true } : item,
    )
  },

  switchSession: async (sessionPath: string) => {
    if (get().sessionFile === sessionPath) return
    try {
      await activateSession(get, () => window.pi.switchSession(sessionPath))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  newSession: async () => {
    try {
      await activateSession(get, () => window.pi.newSession())
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },
}))

let activating: Promise<void> = Promise.resolve()

async function activateSession(get: () => SessionStore, load: () => Promise<SessionSnapshot>) {
  const run = activating.then(
    () => swapSession(get, load),
    () => swapSession(get, load),
  )
  activating = run.then(
    () => undefined,
    () => undefined,
  )
  await run
}

async function swapSession(get: () => SessionStore, load: () => Promise<SessionSnapshot>) {
  const previous = get().sessionFile
  if (previous) stashChat(chatCache, previous, useChat.getState())
  const snapshot = await load()
  if (previous) {
    stashChat(chatCache, previous, useChat.getState())
    dropIdleChat(chatCache, previous)
  }
  const nextFile = snapshot.state.sessionFile ?? null
  applyLiveSnapshot(snapshot, takeChat(chatCache, nextFile))
}
