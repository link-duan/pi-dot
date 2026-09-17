import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent'
import { isAgentMessage, type SessionEvent } from '@shared/protocol'

export function toSessionEvent(event: AgentSessionEvent): SessionEvent | null {
  switch (event.type) {
    case 'agent_start':
      return { type: 'agent_start' }
    case 'agent_end':
      return { type: 'agent_end' }
    case 'message_start':
    case 'message_update':
    case 'message_end':
      if (!isAgentMessage(event.message)) return null
      return { type: event.type, message: event.message }
    case 'tool_execution_start':
      return {
        type: 'tool_execution_start',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      }
    case 'tool_execution_update':
      return {
        type: 'tool_execution_update',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
        partialResult: event.partialResult,
      }
    case 'tool_execution_end':
      return {
        type: 'tool_execution_end',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
        isError: event.isError,
      }
    default:
      return null
  }
}
