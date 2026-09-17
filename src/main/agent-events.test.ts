import { describe, expect, it } from 'vitest'
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent'
import { toSessionEvent } from './agent-events'

const assistant = {
  role: 'assistant' as const,
  content: [{ type: 'text' as const, text: 'Hello' }],
  timestamp: 1,
}

describe('toSessionEvent', () => {
  it('forwards lifecycle events without extra fields', () => {
    expect(toSessionEvent({ type: 'agent_start' })).toEqual({ type: 'agent_start' })
    expect(toSessionEvent({ type: 'agent_end', messages: [], willRetry: false })).toEqual({
      type: 'agent_end',
    })
  })

  it('keeps the cumulative message on message_update', () => {
    const event = {
      type: 'message_update',
      message: assistant,
      assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'o' },
    } as AgentSessionEvent
    expect(toSessionEvent(event)).toEqual({ type: 'message_update', message: assistant })
  })

  it('drops unknown roles and non-UI events', () => {
    expect(
      toSessionEvent({
        type: 'message_end',
        message: { role: 'bashExecution', command: 'ls', timestamp: 1 },
      } as AgentSessionEvent),
    ).toBeNull()
    expect(toSessionEvent({ type: 'turn_start' })).toBeNull()
    expect(toSessionEvent({ type: 'agent_settled' })).toBeNull()
  })

  it('forwards tool execution by toolCallId', () => {
    expect(
      toSessionEvent({
        type: 'tool_execution_start',
        toolCallId: 'call_1',
        toolName: 'bash',
        args: { command: 'ls' },
      }),
    ).toEqual({
      type: 'tool_execution_start',
      toolCallId: 'call_1',
      toolName: 'bash',
      args: { command: 'ls' },
    })
  })
})
