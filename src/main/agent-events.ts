import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent'
import { isAgentMessage, type SessionEvent } from '@shared/protocol'

export function toSessionEvent(event: AgentSessionEvent, sessionFile: string): SessionEvent | null {
  switch (event.type) {
    case 'agent_start':
      return { type: 'agent_start', sessionFile }
    case 'agent_end':
      return { type: 'agent_end', sessionFile, willRetry: event.willRetry }
    case 'message_start':
    case 'message_update':
    case 'message_end':
      if (!isAgentMessage(event.message)) return null
      return { type: event.type, message: event.message, sessionFile }
    case 'tool_execution_start':
      if (event.parentToolCallId) return null
      return {
        type: 'tool_execution_start',
        sessionFile,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      }
    case 'tool_execution_update':
      if (event.parentToolCallId) return null
      return {
        type: 'tool_execution_update',
        sessionFile,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
        partialResult: event.partialResult,
      }
    case 'tool_execution_end':
      if (event.parentToolCallId) return null
      return {
        type: 'tool_execution_end',
        sessionFile,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
        isError: event.isError,
      }
    case 'auto_retry_start':
      return {
        type: 'auto_retry_start',
        sessionFile,
        attempt: event.attempt,
        maxAttempts: event.maxAttempts,
        delayMs: event.delayMs,
      }
    case 'auto_retry_end':
      return { type: 'auto_retry_end', sessionFile }
    case 'queue_update':
      return {
        type: 'queue_update',
        sessionFile,
        steering: [...event.steering],
        followUp: [...event.followUp],
      }
    default:
      return null
  }
}
