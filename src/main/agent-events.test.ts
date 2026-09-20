import { describe, expect, it } from 'vitest'
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent'
import { toSessionEvent } from './agent-events'

const assistant = {
  role: 'assistant' as const,
  content: [{ type: 'text' as const, text: 'Hello' }],
  timestamp: 1,
}

const sessionFile = '/tmp/sess.jsonl'

describe('toSessionEvent', () => {
  it('forwards lifecycle events with the session file', () => {
    expect(toSessionEvent({ type: 'agent_start' }, sessionFile)).toEqual({
      type: 'agent_start',
      sessionFile,
    })
    expect(
      toSessionEvent({ type: 'agent_end', messages: [], willRetry: false }, sessionFile),
    ).toEqual({
      type: 'agent_end',
      sessionFile,
      willRetry: false,
    })
    expect(
      toSessionEvent({ type: 'agent_end', messages: [], willRetry: true }, sessionFile),
    ).toEqual({
      type: 'agent_end',
      sessionFile,
      willRetry: true,
    })
  })

  it('keeps the cumulative message on message_update', () => {
    const event = {
      type: 'message_update',
      message: assistant,
      assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'o' },
    } as AgentSessionEvent
    expect(toSessionEvent(event, sessionFile)).toEqual({
      type: 'message_update',
      message: assistant,
      sessionFile,
    })
  })

  it('drops unknown roles and non-UI events', () => {
    expect(
      toSessionEvent(
        {
          type: 'message_end',
          message: { role: 'bashExecution', command: 'ls', timestamp: 1 },
        } as AgentSessionEvent,
        sessionFile,
      ),
    ).toBeNull()
    expect(toSessionEvent({ type: 'turn_start' }, sessionFile)).toBeNull()
    expect(toSessionEvent({ type: 'agent_settled' }, sessionFile)).toBeNull()
    expect(
      toSessionEvent(
        {
          type: 'compaction_end',
          reason: 'manual',
          result: undefined,
          aborted: false,
          willRetry: false,
        },
        sessionFile,
      ),
    ).toBeNull()
  })

  it('forwards tool execution by toolCallId', () => {
    expect(
      toSessionEvent(
        {
          type: 'tool_execution_start',
          toolCallId: 'call_1',
          toolName: 'bash',
          args: { command: 'ls' },
        },
        sessionFile,
      ),
    ).toEqual({
      type: 'tool_execution_start',
      sessionFile,
      toolCallId: 'call_1',
      toolName: 'bash',
      args: { command: 'ls' },
    })
  })
})
