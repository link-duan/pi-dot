import {
  isAgentMessage,
  type AgentMessage,
  type SessionEventBody,
  type TextContent,
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
}

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
  }
}

export function hydrateMessages(
  messages: unknown[],
  options?: { isStreaming?: boolean; persistedAt?: number[] },
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
  }
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

    case 'message_start': {
      if (!event.message?.role) return state
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
