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

  it('forwards queue_update events', () => {
    expect(
      toSessionEvent(
        {
          type: 'queue_update',
          steering: ['steer msg'],
          followUp: ['followup msg'],
        } as AgentSessionEvent,
        sessionFile,
      ),
    ).toEqual({
      type: 'queue_update',
      sessionFile,
      steering: ['steer msg'],
      followUp: ['followup msg'],
    })
  })

  it('forwards auto retry events', () => {
    expect(
      toSessionEvent(
        {
          type: 'auto_retry_start',
          attempt: 1,
          maxAttempts: 3,
          delayMs: 2000,
          errorMessage: 'terminated',
        },
        sessionFile,
      ),
    ).toEqual({
      type: 'auto_retry_start',
      sessionFile,
      attempt: 1,
      maxAttempts: 3,
      delayMs: 2000,
    })
    expect(
      toSessionEvent(
        { type: 'auto_retry_end', success: false, attempt: 3, finalError: 'terminated' },
        sessionFile,
      ),
    ).toEqual({ type: 'auto_retry_end', sessionFile })
  })

  it('drops nested tool execution events without a transcript tool call', () => {
    const call = {
      toolCallId: 'nested_1',
      parentToolCallId: 'call_1',
      toolName: 'read',
      args: { path: 'package.json' },
    }
    const result = { content: [{ type: 'text' as const, text: '{}' }] }
    const events: AgentSessionEvent[] = [
      { type: 'tool_execution_start', ...call },
      { type: 'tool_execution_update', ...call, partialResult: result },
      { type: 'tool_execution_end', ...call, result, isError: false },
    ]
    for (const event of events) {
      expect(toSessionEvent(event, sessionFile)).toBeNull()
    }
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
