import { describe, expect, it } from 'vitest'
import type { AssistantMessage, UserMessage } from '@shared/protocol'
import { applySessionEvent, createChatState, userText } from './state'

const user = (text: string): UserMessage => ({
  role: 'user',
  content: text,
  timestamp: 1,
})

const assistant = (text: string): AssistantMessage => ({
  role: 'assistant',
  content: [{ type: 'text', text }],
  timestamp: 2,
})

describe('applySessionEvent', () => {
  it('does not duplicate user messages across start and end', () => {
    let state = createChatState()
    state = applySessionEvent(state, { type: 'message_start', message: user('hi') })
    state = applySessionEvent(state, { type: 'message_end', message: user('hi') })
    expect(state.messages).toHaveLength(1)
    expect(userText(state.messages[0]!)).toBe('hi')
  })

  it('replaces the streaming assistant in place', () => {
    let state = createChatState()
    state = applySessionEvent(state, { type: 'agent_start' })
    state = applySessionEvent(state, { type: 'message_start', message: assistant('Hel') })
    expect(state.assistantStreaming).toBe(true)
    state = applySessionEvent(state, { type: 'message_update', message: assistant('Hello') })
    expect(state.assistantStreaming).toBe(true)
    state = applySessionEvent(state, { type: 'message_end', message: assistant('Hello world') })
    expect(state.assistantStreaming).toBe(false)
    expect(state.isStreaming).toBe(true)
    state = applySessionEvent(state, { type: 'agent_end' })

    expect(state.isStreaming).toBe(false)
    expect(state.assistantStreaming).toBe(false)
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0]).toMatchObject({
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello world' }],
    })
  })

  it('keeps assistantStreaming off after message_end while tools still run', () => {
    let state = createChatState()
    state = applySessionEvent(state, { type: 'agent_start' })
    state = applySessionEvent(state, { type: 'message_start', message: assistant('done') })
    state = applySessionEvent(state, { type: 'message_end', message: assistant('done') })
    state = applySessionEvent(state, {
      type: 'tool_execution_start',
      toolCallId: 'call_1',
      toolName: 'bash',
      args: { command: 'ls' },
    })

    expect(state.isStreaming).toBe(true)
    expect(state.assistantStreaming).toBe(false)
  })

  it('tracks tool execution by toolCallId', () => {
    let state = createChatState()
    state = applySessionEvent(state, {
      type: 'tool_execution_start',
      toolCallId: 'call_1',
      toolName: 'bash',
      args: { command: 'ls' },
    })
    state = applySessionEvent(state, {
      type: 'tool_execution_update',
      toolCallId: 'call_1',
      toolName: 'bash',
      args: { command: 'ls' },
      partialResult: { content: [{ type: 'text', text: 'a' }] },
    })
    state = applySessionEvent(state, {
      type: 'tool_execution_end',
      toolCallId: 'call_1',
      toolName: 'bash',
      result: { content: [{ type: 'text', text: 'a\nb' }] },
      isError: false,
    })

    expect(state.toolLive.call_1).toMatchObject({
      toolName: 'bash',
      status: 'done',
      isError: false,
    })
  })
})
