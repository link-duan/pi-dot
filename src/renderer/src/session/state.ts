import { applySessionEvent, createChatState, hydrateMessages, type ChatState } from '@/chat/state'
import type { PlanComment } from '@/lib/plan-feedback'
import {
  ASK_USER_TOOL,
  askQuestions,
  type AskQuestion,
  type CommandInfo,
  type ConnectionStatus,
  type ContextUsage,
  type ModelInfo,
  type SessionEvent,
  type SessionSnapshot,
  type SkillInfo,
  type ThinkingLevel,
  type UiRequest,
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
  commands: CommandInfo[]
  /** False when the user declined to trust the project's own resources. */
  trusted: boolean
  contextUsage: ContextUsage | null
  sessionId: string | null
  sessionFile: string | null
  focusNonce: number
  /** The active session's Plan File content, as last read. */
  planText: string
  /** The Plan File `planText` was read from; comments belong to it. */
  planSource: string
  planViewer: boolean
  /** Draft inline comments on the active session's plan, sent with feedback or Build. */
  planComments: PlanComment[]
  /** The inline comment being written; Build and feedback send it too if it has text. */
  planDraft: PlanComment | null
  running: string[]
  /** Sessions that finished (`done`) or wait for the user (`input`) while not shown. */
  attention: Record<string, Attention>
  /** The active session was rewound to edit a message; `leafId` returns to where it was. */
  editing: { sessionFile: string; leafId: string | null } | null
  /** Text for the Composer to take once, e.g. the message being edited. */
  composerFill: { text: string } | null
  chats: Record<string, ChatState>
}

export type Attention = 'done' | 'input'

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
    commands: [],
    trusted: true,
    contextUsage: null,
    sessionId: null,
    sessionFile: null,
    focusNonce: 0,
    planText: '',
    planSource: '',
    planViewer: false,
    planComments: [],
    planDraft: null,
    running: [],
    attention: {},
    editing: null,
    composerFill: null,
    chats: {},
  }
}

export const noPlanReview = {
  planComments: [],
  planDraft: null,
  planSource: '',
} satisfies Partial<WindowState>

/** Saved comments plus the draft, if it has text: what Build and feedback send. */
export function reviewComments(state: WindowState): PlanComment[] {
  return state.planDraft?.text.trim()
    ? [...state.planComments, state.planDraft]
    : state.planComments
}

/**
 * Which Plan surface to show: the full review card, or the read-only pill for a built plan or
 * one being revised (feedback sent, the run still going); or none.
 */
export function planCard(state: WindowState): 'review' | 'view' | null {
  const chat = activeChat(state)
  // Text read for another plan (still loading the current one) is never shown under its name.
  if (!state.planText || !chat.plan || state.planSource !== chat.plan.path) return null
  if (chat.plan.built) return 'view'
  if (!chat.planMode) return null
  return chat.isStreaming ? 'view' : 'review'
}

/** The active session's `ask_user` call waiting for the user, if any. */
export function pendingQuestion(
  state: WindowState,
): { toolCallId: string; questions: AskQuestion[] } | null {
  for (const tool of Object.values(activeChat(state).toolLive)) {
    if (tool.status !== 'running' || tool.toolName !== ASK_USER_TOOL) continue
    const questions = askQuestions(tool.args)
    if (questions.length > 0) return { toolCallId: tool.toolCallId, questions }
  }
  return null
}

/** The active session's oldest extension dialog, unless an `ask_user` call waits first. */
export function pendingUiRequest(state: WindowState): { request: UiRequest; count: number } | null {
  if (pendingQuestion(state)) return null
  const requests = activeChat(state).uiRequests
  return requests[0] ? { request: requests[0], count: requests.length } : null
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
    error: null,
    models: snapshot.models,
    model: snapshot.state.model ?? snapshot.models[0] ?? null,
    thinkingLevel: snapshot.state.thinkingLevel,
    thinkingLevels: snapshot.thinkingLevels,
    running: snapshot.runningSessionFiles,
    skills: snapshot.skills,
    commands: snapshot.commands,
    trusted: snapshot.trusted,
    contextUsage: snapshot.contextUsage ?? null,
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
        plan: snapshot.state.plan,
        steeringQueue: [...steeringQueue],
        followUpQueue: [...followUpQueue],
        uiRequests: snapshot.ui.requests,
        ui: snapshot.ui.state,
      }
    : hydrateMessages(snapshot.messages, {
        isStreaming: snapshot.state.isStreaming,
        persistedAt: snapshot.messagePersistedAt,
        steeringQueue,
        followUpQueue,
        planMode: snapshot.state.planMode,
        plan: snapshot.state.plan,
        ui: snapshot.ui,
      })
  const chats = { ...state.chats }
  if (sessionFile) chats[sessionFile] = chat
  const attention = { ...state.attention }
  if (sessionFile) delete attention[sessionFile]
  return {
    ...state,
    ...snapshotMeta(snapshot),
    // A reload of the same session (e.g. after a provider login) keeps the plan review open.
    ...(sessionFile !== state.sessionFile
      ? { planViewer: false, ...noPlanReview, editing: null }
      : null),
    attention,
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
  const attention = isActive ? state.attention : nextAttention(state.attention, event)
  const existing = state.chats[file]
  if (isActive || existing) {
    const nextChat = applySessionEvent(existing ?? createChatState(), event)
    const chats = { ...state.chats, [file]: nextChat }
    if (!isActive && event.type === 'agent_end' && !event.willRetry) {
      delete chats[file]
    }
    return { ...state, running, attention, chats }
  }

  return running === state.running && attention === state.attention
    ? state
    : { ...state, running, attention }
}

function nextAttention(
  attention: Record<string, Attention>,
  event: SessionEvent,
): Record<string, Attention> {
  const file = event.sessionFile
  const asks =
    (event.type === 'tool_execution_start' && event.toolName === ASK_USER_TOOL) ||
    event.type === 'ui_request'
  const answered =
    (event.type === 'tool_execution_end' && event.toolName === ASK_USER_TOOL) ||
    event.type === 'ui_dismiss'
  if (asks) return attention[file] === 'input' ? attention : { ...attention, [file]: 'input' }
  if (event.type === 'agent_end' && !event.willRetry) return { ...attention, [file]: 'done' }
  if (answered && attention[file] === 'input') {
    const next = { ...attention }
    delete next[file]
    return next
  }
  return attention
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
