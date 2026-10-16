import {
  isAgentMessage,
  type AgentMessage,
  type NotifyLevel,
  type LoopRef,
  type PlanRef,
  type SessionEventBody,
  type TextContent,
  type UiRequest,
  type UiState,
} from '@shared/protocol'

export interface ToolLiveState {
  toolCallId: string
  toolName: string
  args: unknown
  partialResult?: unknown
  result?: unknown
  isError?: boolean
  status: 'running' | 'done'
}

export interface RetryState {
  attempt: number
  maxAttempts: number
  retryAt: number
}

export interface ChatState {
  messages: AgentMessage[]
  persistedAt: number[]
  toolLive: Record<string, ToolLiveState>
  isStreaming: boolean
  assistantStreaming: boolean
  turnActive: boolean
  turnStartedAt: number | null
  turnEndedAt: number | null
  retry: RetryState | null
  steeringQueue: string[]
  followUpQueue: string[]
  /** The Plan Mode toggle; sent with the next prompt. */
  planMode: boolean
  /** Plan Mode in effect in main; a run that ends in it shows the plan full-window. */
  planActive: boolean
  /** The session's current Plan File, as main replayed it from the transcript. */
  plan: PlanRef
  /** The session's running /loop. */
  loop: LoopRef
  /**
   * The Loop toggle: the next message starts a loop at this interval (null to self-pace), or
   * changes the running loop's prompt.
   */
  loopDraft: { kind: 'start'; ms: number | null } | { kind: 'edit' } | null
  /** The session's name, once the auto title or an extension sets it. */
  sessionName?: string
  /** Extension dialogs waiting for the user, oldest first. */
  uiRequests: UiRequest[]
  ui: UiState
  extensionLines: ExtensionLine[]
}

/**
 * A Transcript line from an extension that is not in the session file, so it is gone once the
 * session loads again, as in pi's TUI. `at` is `messages.length` when it was added: the line
 * shows after the message before it.
 */
export type ExtensionLine =
  /** An extension command the user ran, e.g. `/tps overrides`. */
  | { kind: 'command'; at: number; text: string }
  /** What the extension said with `ctx.ui.notify`. */
  | { kind: 'notice'; at: number; level: NotifyLevel; message: string }
  /** An extension that threw; `count` is how many times in a row it failed the same way. */
  | {
      kind: 'error'
      at: number
      extensionPath: string
      event: string
      message: string
      count: number
    }

const EMPTY_UI: UiState = { statuses: {}, widgets: [] }

export function createChatState(): ChatState {
  return {
    messages: [],
    persistedAt: [],
    toolLive: {},
    isStreaming: false,
    assistantStreaming: false,
    turnActive: false,
    turnStartedAt: null,
    turnEndedAt: null,
    retry: null,
    steeringQueue: [],
    followUpQueue: [],
    planMode: false,
    planActive: false,
    plan: null,
    loop: null,
    loopDraft: null,
    uiRequests: [],
    ui: EMPTY_UI,
    extensionLines: [],
  }
}

export function hydrateMessages(
  messages: unknown[],
  options?: {
    isStreaming?: boolean
    persistedAt?: number[]
    steeringQueue?: string[]
    followUpQueue?: string[]
    planMode?: boolean
    plan?: PlanRef
    loop?: LoopRef
    sessionName?: string
    ui?: { requests: UiRequest[]; state: UiState }
  },
): ChatState {
  const next = messages.filter(isAgentMessage)
  const isStreaming = Boolean(options?.isStreaming)
  const last = next[next.length - 1]
  const assistantStreaming = isStreaming && last?.role === 'assistant'
  const toolLive = isStreaming ? inferRunningTools(next) : {}
  return {
    messages: next,
    persistedAt: syncPersistedAt(next, options?.persistedAt ?? []),
    toolLive,
    isStreaming,
    assistantStreaming,
    turnActive:
      assistantStreaming || Object.values(toolLive).some((tool) => tool.status === 'running'),
    turnStartedAt: isStreaming ? Date.now() : null,
    turnEndedAt: null,
    retry: null,
    steeringQueue: options?.steeringQueue ? [...options.steeringQueue] : [],
    followUpQueue: options?.followUpQueue ? [...options.followUpQueue] : [],
    planMode: Boolean(options?.planMode),
    planActive: Boolean(options?.planMode),
    plan: options?.plan ?? null,
    loop: options?.loop ?? null,
    loopDraft: null,
    sessionName: options?.sessionName,
    uiRequests: options?.ui?.requests ?? [],
    ui: options?.ui?.state ?? EMPTY_UI,
    extensionLines: [],
  }
}

/**
 * Appends `line`. At the same place, an info right after an info replaces it, as pi's status line
 * does; and an error right after one from the same extension and event folds into it with a
 * count, as browser consoles do with repeats, so a handler that throws on every streamed update
 * shows once. A command in between keeps both.
 */
export function appendExtensionLine(lines: ExtensionLine[], line: ExtensionLine): ExtensionLine[] {
  const last = lines.at(-1)
  const rest = lines.slice(0, -1)
  if (last?.at === line.at) {
    if (isInfo(line) && isInfo(last)) return [...rest, line]
    if (line.kind === 'error' && last.kind === 'error' && sameSource(line, last)) {
      return [...rest, { ...line, count: last.count + 1 }]
    }
  }
  return [...lines, line]
}

type ErrorLine = Extract<ExtensionLine, { kind: 'error' }>

function sameSource(a: ErrorLine, b: ErrorLine): boolean {
  return a.extensionPath === b.extensionPath && a.event === b.event
}

function isInfo(line: ExtensionLine): line is Extract<ExtensionLine, { kind: 'notice' }> {
  return line.kind === 'notice' && line.level === 'info'
}

function inferRunningTools(messages: AgentMessage[]): Record<string, ToolLiveState> {
  const results = new Set<string>()
  for (const message of messages) {
    if (message.role === 'toolResult') results.add(message.toolCallId)
  }
  const toolLive: Record<string, ToolLiveState> = {}
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    for (const block of message.content) {
      if (block.type !== 'toolCall' || results.has(block.id)) continue
      toolLive[block.id] = {
        toolCallId: block.id,
        toolName: block.name,
        args: block.arguments,
        status: 'running',
      }
    }
  }
  return toolLive
}

function replaceLastWithRole(messages: AgentMessage[], message: AgentMessage): AgentMessage[] {
  const role = message.role
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === role) {
      const next = messages.slice()
      next[i] = message
      return next
    }
  }
  return [...messages, message]
}

function upsertTool(state: ChatState, next: ToolLiveState): ChatState {
  return {
    ...state,
    toolLive: { ...state.toolLive, [next.toolCallId]: next },
  }
}

function syncPersistedAt(messages: AgentMessage[], persistedAt: number[]): number[] {
  if (persistedAt.length === messages.length) return persistedAt
  if (persistedAt.length > messages.length) return persistedAt.slice(0, messages.length)
  const next = persistedAt.slice()
  for (let i = persistedAt.length; i < messages.length; i++) {
    next.push(messages[i]?.timestamp ?? 0)
  }
  return next
}

function withMessages(state: ChatState, messages: AgentMessage[]): ChatState {
  return { ...state, messages, persistedAt: syncPersistedAt(messages, state.persistedAt) }
}

export function applySessionEvent(state: ChatState, event: SessionEventBody): ChatState {
  switch (event.type) {
    case 'agent_start':
      return {
        ...state,
        isStreaming: true,
        turnStartedAt:
          state.isStreaming && state.turnStartedAt != null ? state.turnStartedAt : Date.now(),
        turnEndedAt: null,
        turnActive: false,
        retry: null,
      }

    case 'agent_end':
      if (event.willRetry) return { ...state, isStreaming: true }
      return {
        ...state,
        isStreaming: false,
        assistantStreaming: false,
        turnEndedAt: Date.now(),
        retry: null,
      }

    case 'plan_mode':
      return { ...state, planActive: event.active, plan: event.plan }

    case 'loop':
      // A prompt being edited has no loop left to change once it ends.
      return {
        ...state,
        loop: event.loop,
        loopDraft: !event.loop && state.loopDraft?.kind === 'edit' ? null : state.loopDraft,
      }

    case 'session_name':
      return { ...state, sessionName: event.name }

    case 'message_start': {
      if (!event.message?.role) return state
      const last = state.messages[state.messages.length - 1]
      if (
        last &&
        last.role === 'user' &&
        event.message.role === 'user' &&
        userText(last) === userText(event.message)
      ) {
        return withMessages(state, replaceLastWithRole(state.messages, event.message))
      }
      return {
        ...withMessages(state, [...state.messages, event.message]),
        assistantStreaming: event.message.role === 'assistant' ? true : state.assistantStreaming,
        turnActive: event.message.role === 'assistant' ? true : state.turnActive,
      }
    }

    case 'message_update': {
      if (!event.message?.role) return state
      return withMessages(state, replaceLastWithRole(state.messages, event.message))
    }

    case 'message_end': {
      if (!event.message?.role) return state
      return {
        ...withMessages(state, replaceLastWithRole(state.messages, event.message)),
        assistantStreaming: event.message.role === 'assistant' ? false : state.assistantStreaming,
      }
    }

    case 'tool_execution_start': {
      const toolCallId = String(event.toolCallId ?? '')
      if (!toolCallId) return state
      return {
        ...upsertTool(state, {
          toolCallId,
          toolName: String(event.toolName ?? ''),
          args: event.args,
          status: 'running',
        }),
        turnActive: true,
      }
    }

    case 'tool_execution_update': {
      const toolCallId = String(event.toolCallId ?? '')
      if (!toolCallId) return state
      const prev = state.toolLive[toolCallId]
      return upsertTool(state, {
        toolCallId,
        toolName: String(event.toolName ?? prev?.toolName ?? ''),
        args: event.args ?? prev?.args,
        partialResult: event.partialResult,
        status: 'running',
      })
    }

    case 'context_usage':
      return state

    case 'queue_update':
      return {
        ...state,
        steeringQueue: [...event.steering],
        followUpQueue: [...event.followUp],
      }

    case 'auto_retry_start':
      return {
        ...state,
        isStreaming: true,
        retry: {
          attempt: event.attempt,
          maxAttempts: event.maxAttempts,
          retryAt: Date.now() + event.delayMs,
        },
      }

    case 'auto_retry_end':
      return { ...state, retry: null }

    case 'ui_request':
      return { ...state, uiRequests: [...state.uiRequests, event.request] }

    case 'ui_dismiss':
      return { ...state, uiRequests: state.uiRequests.filter((item) => item.id !== event.id) }

    case 'ui_state':
      return { ...state, ui: event.state }

    case 'ui_notify':
      return {
        ...state,
        extensionLines: appendExtensionLine(state.extensionLines, {
          kind: 'notice',
          at: state.messages.length,
          level: event.level,
          message: event.message,
        }),
      }

    case 'extension_error':
      return {
        ...state,
        extensionLines: appendExtensionLine(state.extensionLines, {
          kind: 'error',
          at: state.messages.length,
          extensionPath: event.extensionPath,
          event: event.event,
          message: event.message,
          count: 1,
        }),
      }

    case 'ui_editor_text':
      return state

    case 'tool_execution_end': {
      const toolCallId = String(event.toolCallId ?? '')
      if (!toolCallId) return state
      const prev = state.toolLive[toolCallId]
      return upsertTool(state, {
        toolCallId,
        toolName: String(event.toolName ?? prev?.toolName ?? ''),
        args: prev?.args,
        result: event.result,
        isError: Boolean(event.isError),
        status: 'done',
      })
    }
  }
}

export function userText(message: AgentMessage): string {
  if (message.role !== 'user') return ''
  if (typeof message.content === 'string') return message.content
  return message.content
    .filter((block): block is TextContent => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}
