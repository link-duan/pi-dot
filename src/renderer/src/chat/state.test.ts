import { describe, expect, it } from 'vitest'
import type { AssistantMessage, UserMessage } from '@shared/protocol'
import { applyRpcEvent, createChatState, userText } from './state'

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

describe('applyRpcEvent', () => {
  it('does not duplicate user messages across start and end', () => {
    let state = createChatState()
    state = applyRpcEvent(state, { type: 'message_start', message: user('hi') })
    state = applyRpcEvent(state, { type: 'message_end', message: user('hi') })
    expect(state.messages).toHaveLength(1)
    expect(userText(state.messages[0]!)).toBe('hi')
  })

  it('replaces the streaming assistant in place', () => {
    let state = createChatState()
    state = applyRpcEvent(state, { type: 'agent_start' })
    state = applyRpcEvent(state, { type: 'message_start', message: assistant('Hel') })
    state = applyRpcEvent(state, { type: 'message_update', message: assistant('Hello') })
    state = applyRpcEvent(state, { type: 'message_end', message: assistant('Hello world') })
    state = applyRpcEvent(state, { type: 'agent_end' })

    expect(state.isStreaming).toBe(false)
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0]).toMatchObject({
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello world' }],
    })
  })

  it('tracks tool execution by toolCallId', () => {
    let state = createChatState()
    state = applyRpcEvent(state, {
      type: 'tool_execution_start',
      toolCallId: 'call_1',
      toolName: 'bash',
      args: { command: 'ls' },
    })
    state = applyRpcEvent(state, {
      type: 'tool_execution_update',
      toolCallId: 'call_1',
      toolName: 'bash',
      args: { command: 'ls' },
      partialResult: { content: [{ type: 'text', text: 'a' }] },
    })
    state = applyRpcEvent(state, {
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
