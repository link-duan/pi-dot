import { applySessionEvent, createChatState, hydrateMessages, type ChatState } from '@/chat/state'
import type {
  ConnectionStatus,
  ContextUsage,
  ModelInfo,
  SessionEvent,
  SessionSnapshot,
  SkillInfo,
  ThinkingLevel,
} from '@shared/protocol'

export type WindowState = {
  lastCwd: string | null
  cwd: string | null
  connection: ConnectionStatus
  error: string | null
  models: ModelInfo[]
  model: ModelInfo | null
  thinkingLevel: ThinkingLevel
  thinkingLevels: ThinkingLevel[]
  skills: SkillInfo[]
  contextUsage: ContextUsage | null
  sessionId: string | null
  sessionFile: string | null
  focusNonce: number
  /** The active session's Plan File and its last read content. */
  planPath: string
  planText: string
  planViewer: boolean
  running: string[]
  chats: Record<string, ChatState>
}

const EMPTY_CHAT = createChatState()

export function createWindowState(): WindowState {
  return {
    lastCwd: null,
    cwd: null,
    connection: 'disconnected',
    error: null,
    models: [],
    model: null,
    thinkingLevel: 'off',
    thinkingLevels: [],
    skills: [],
    contextUsage: null,
    sessionId: null,
    sessionFile: null,
    focusNonce: 0,
    planPath: '',
    planText: '',
    planViewer: false,
    running: [],
    chats: {},
  }
}

export function activeChat(state: WindowState): ChatState {
  if (!state.sessionFile) return EMPTY_CHAT
  return state.chats[state.sessionFile] ?? EMPTY_CHAT
}

function snapshotMeta(snapshot: SessionSnapshot) {
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
    running: snapshot.runningSessionFiles,
    skills: snapshot.skills,
    contextUsage: snapshot.contextUsage ?? null,
    planPath: snapshot.state.planPath,
    planViewer: false,
  }
}

export function applySnapshot<T extends WindowState>(
  state: T,
  snapshot: SessionSnapshot,
  cached?: ChatState,
): T {
  const sessionFile = snapshot.state.sessionFile ?? null
  const steeringQueue = snapshot.steeringQueue ?? snapshot.state.steeringQueue ?? []
  const followUpQueue = snapshot.followUpQueue ?? snapshot.state.followUpQueue ?? []
  const chat = cached
    ? {
        ...cached,
        planActive: snapshot.state.planMode,
        steeringQueue: [...steeringQueue],
        followUpQueue: [...followUpQueue],
      }
    : hydrateMessages(snapshot.messages, {
        isStreaming: snapshot.state.isStreaming,
        persistedAt: snapshot.messagePersistedAt,
        steeringQueue,
        followUpQueue,
        planMode: snapshot.state.planMode,
      })
  const chats = { ...state.chats }
  if (sessionFile) chats[sessionFile] = chat
  return {
    ...state,
    ...snapshotMeta(snapshot),
    chats,
  }
}

export function applyEvent<T extends WindowState>(state: T, event: SessionEvent): T {
  const file = event.sessionFile

  if (event.type === 'context_usage') {
    if (file !== state.sessionFile) return state
    return { ...state, contextUsage: event.usage }
  }

  let running = state.running
  if (event.type === 'agent_start') {
    if (!running.includes(file)) running = [...running, file]
  } else if (event.type === 'agent_end' && !event.willRetry) {
    running = running.filter((item) => item !== file)
  }

  const isActive = file === state.sessionFile
  const existing = state.chats[file]
  if (isActive || existing) {
    const nextChat = applySessionEvent(existing ?? createChatState(), event)
    const chats = { ...state.chats, [file]: nextChat }
    if (!isActive && event.type === 'agent_end' && !event.willRetry) {
      delete chats[file]
    }
    return { ...state, running, chats }
  }

  return running === state.running ? state : { ...state, running }
}

export function parkActive<T extends WindowState>(state: T): T {
  const file = state.sessionFile
  if (!file) return state
  const chat = state.chats[file]
  if (!chat || chat.isStreaming) return state
  const chats = { ...state.chats }
  delete chats[file]
  return { ...state, chats }
}

export function patchChat<T extends WindowState>(
  state: T,
  file: string,
  patch: Partial<ChatState>,
): T {
  const current = state.chats[file]
  if (!current) return state
  return { ...state, chats: { ...state.chats, [file]: { ...current, ...patch } } }
}

export function resetFolder<T extends WindowState>(state: T): T {
  return {
    ...state,
    ...createWindowState(),
    lastCwd: state.lastCwd,
  }
}
