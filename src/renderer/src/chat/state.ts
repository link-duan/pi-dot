import {
  isAgentMessage,
  type AgentMessage,
  type SessionEvent,
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

export interface ChatState {
  messages: AgentMessage[]
  toolLive: Record<string, ToolLiveState>
  isStreaming: boolean
  assistantStreaming: boolean
}

export function createChatState(): ChatState {
  return { messages: [], toolLive: {}, isStreaming: false, assistantStreaming: false }
}

export function hydrateMessages(messages: unknown[]): ChatState {
  return {
    messages: messages.filter(isAgentMessage),
    toolLive: {},
    isStreaming: false,
    assistantStreaming: false,
  }
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

export function applySessionEvent(state: ChatState, event: SessionEvent): ChatState {
  switch (event.type) {
    case 'agent_start':
      return { ...state, isStreaming: true }

    case 'agent_end':
      return { ...state, isStreaming: false, assistantStreaming: false }

    case 'message_start': {
      if (!event.message?.role) return state
      return {
        ...state,
        messages: [...state.messages, event.message],
        assistantStreaming: event.message.role === 'assistant' ? true : state.assistantStreaming,
      }
    }

    case 'message_update': {
      if (!event.message?.role) return state
      return { ...state, messages: replaceLastWithRole(state.messages, event.message) }
    }

    case 'message_end': {
      if (!event.message?.role) return state
      return {
        ...state,
        messages: replaceLastWithRole(state.messages, event.message),
        assistantStreaming: event.message.role === 'assistant' ? false : state.assistantStreaming,
      }
    }

    case 'tool_execution_start': {
      const toolCallId = String(event.toolCallId ?? '')
      if (!toolCallId) return state
      return upsertTool(state, {
        toolCallId,
        toolName: String(event.toolName ?? ''),
        args: event.args,
        status: 'running',
      })
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
