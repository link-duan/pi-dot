import { describe, expect, it } from 'vitest'
import type { AssistantMessage, UserMessage } from '@shared/protocol'
import {
  appendExtensionLine,
  applySessionEvent,
  createChatState,
  hydrateMessages,
  userText,
  type ExtensionLine,
} from './state'

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

describe('hydrateMessages', () => {
  it('restores streaming flags and unfinished tool calls', () => {
    const state = hydrateMessages(
      [
        assistant('working'),
        {
          role: 'assistant',
          content: [{ type: 'toolCall', id: 'call_1', name: 'bash', arguments: { command: 'ls' } }],
          timestamp: 3,
        },
      ],
      { isStreaming: true },
    )
    expect(state.isStreaming).toBe(true)
    expect(state.assistantStreaming).toBe(true)
    expect(state.turnActive).toBe(true)
    expect(state.persistedAt).toEqual([2, 3])
    expect(state.toolLive.call_1).toMatchObject({ toolName: 'bash', status: 'running' })
  })

  it('restores queued messages from options', () => {
    const state = hydrateMessages([], {
      steeringQueue: ['steer 1'],
      followUpQueue: ['follow 1', 'follow 2'],
    })
    expect(state.steeringQueue).toEqual(['steer 1'])
    expect(state.followUpQueue).toEqual(['follow 1', 'follow 2'])
  })
})

describe('applySessionEvent', () => {
  it('does not duplicate user messages across start and end', () => {
    let state = createChatState()
    state = applySessionEvent(state, { type: 'message_start', message: user('hi') })
    state = applySessionEvent(state, { type: 'message_end', message: user('hi') })
    expect(state.messages).toHaveLength(1)
    expect(userText(state.messages[0]!)).toBe('hi')
  })

  it('reconciles optimistic user message on backend message_start', () => {
    let state = createChatState()
    // Optimistic user message pushed locally with temporary timestamp
    state = {
      ...state,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }], timestamp: 100 }],
    }
    // Backend returns official message_start with server timestamp
    state = applySessionEvent(state, {
      type: 'message_start',
      message: { role: 'user', content: [{ type: 'text', text: 'hello' }], timestamp: 200 },
    })
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0]?.timestamp).toBe(200)
    expect(userText(state.messages[0]!)).toBe('hello')
  })

  it('appends message_start even when role and timestamp match the last message', () => {
    let state = createChatState()
    state = applySessionEvent(state, { type: 'message_start', message: assistant('Hel') })
    state = applySessionEvent(state, { type: 'message_start', message: assistant('Hello') })
    expect(state.messages).toHaveLength(2)
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

  it('keeps streaming across a retrying agent_end', () => {
    let state = createChatState()
    state = applySessionEvent(state, { type: 'agent_start' })
    state = applySessionEvent(state, { type: 'agent_end', willRetry: true })
    expect(state.isStreaming).toBe(true)
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

  it('tracks turn timing and waiting vs working', () => {
    let state = createChatState()
    state = applySessionEvent(state, { type: 'agent_start' })
    expect(state.turnActive).toBe(false)
    expect(state.turnStartedAt).toEqual(expect.any(Number))
    expect(state.turnEndedAt).toBeNull()

    state = applySessionEvent(state, { type: 'message_start', message: assistant('Hel') })
    expect(state.turnActive).toBe(true)
    expect(state.persistedAt).toEqual([2])

    state = applySessionEvent(state, { type: 'agent_end' })
    expect(state.isStreaming).toBe(false)
    expect(state.turnEndedAt).toEqual(expect.any(Number))
  })

  it('tracks auto retry countdown and clears it on the next start', () => {
    let state = createChatState()
    state = applySessionEvent(state, { type: 'agent_start' })
    state = applySessionEvent(state, {
      type: 'auto_retry_start',
      attempt: 1,
      maxAttempts: 3,
      delayMs: 2000,
    })
    expect(state.isStreaming).toBe(true)
    expect(state.retry).toEqual({
      attempt: 1,
      maxAttempts: 3,
      retryAt: expect.any(Number),
    })
    expect(state.retry!.retryAt).toBeGreaterThan(Date.now())

    state = applySessionEvent(state, { type: 'auto_retry_end' })
    expect(state.retry).toBeNull()

    state = applySessionEvent(state, {
      type: 'auto_retry_start',
      attempt: 2,
      maxAttempts: 3,
      delayMs: 4000,
    })
    state = applySessionEvent(state, { type: 'agent_start' })
    expect(state.retry).toBeNull()
  })

  it('ignores context usage events', () => {
    const state = createChatState()
    expect(
      applySessionEvent(state, {
        type: 'context_usage',
        usage: {
          tokens: 1000,
          contextWindow: 128_000,
          percent: 1,
          session: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
          compacting: false,
        },
      }),
    ).toBe(state)
  })

  it('updates steeringQueue and followUpQueue on queue_update event', () => {
    let state = createChatState()
    state = applySessionEvent(state, {
      type: 'queue_update',
      steering: ['fix the typo'],
      followUp: ['add tests', 'update docs'],
    })
    expect(state.steeringQueue).toEqual(['fix the typo'])
    expect(state.followUpQueue).toEqual(['add tests', 'update docs'])
  })
})

describe('extension lines', () => {
  const info = (message: string, at = 0) =>
    ({ kind: 'notice', at, level: 'info', message }) as const
  const command = (text: string, at = 0) => ({ kind: 'command', at, text }) as const
  const texts = (lines: ExtensionLine[]) =>
    lines.map((line) => (line.kind === 'command' ? line.text : line.message))

  it('places a notice after the messages so far', () => {
    const state = applySessionEvent(hydrateMessages([user('/status'), assistant('ok')]), {
      type: 'ui_notify',
      message: 'All good',
      level: 'info',
    })
    expect(state.extensionLines).toEqual([info('All good', 2)])
  })

  it('replaces an info right after another info at the same place, as pi does', () => {
    let lines = appendExtensionLine([], info('Syncing'))
    lines = appendExtensionLine(lines, info('Synced'))
    expect(texts(lines)).toEqual(['Synced'])
    lines = appendExtensionLine(lines, info('Later', 1))
    expect(texts(lines)).toEqual(['Synced', 'Later'])
  })

  it('keeps the result of one command when the next one reports', () => {
    let lines = appendExtensionLine([], command('/status'))
    lines = appendExtensionLine(lines, info('All good'))
    lines = appendExtensionLine(lines, command('/quota'))
    lines = appendExtensionLine(lines, info('80% left'))
    expect(texts(lines)).toEqual(['/status', 'All good', '/quota', '80% left'])
  })

  describe('errors', () => {
    const fail = (message: string, at = 0, event = 'command') =>
      ({ kind: 'error', at, extensionPath: 'command:deploy', event, message, count: 1 }) as const
    const counts = (lines: ExtensionLine[]) =>
      lines.map((line) => (line.kind === 'error' ? line.count : line.kind))

    it('adds an extension error after the messages so far', () => {
      const state = applySessionEvent(hydrateMessages([user('/deploy')]), {
        type: 'extension_error',
        extensionPath: 'command:deploy',
        event: 'command',
        message: 'boom',
      })
      expect(state.extensionLines).toEqual([fail('boom', 1)])
    })

    it('folds repeats from the same source into one line with a count', () => {
      let lines = appendExtensionLine([], fail('boom 1'))
      lines = appendExtensionLine(lines, fail('boom 2'))
      lines = appendExtensionLine(lines, fail('boom 3'))
      expect(lines).toEqual([{ ...fail('boom 3'), count: 3 }])
    })

    it('shows a command failing again under its own line', () => {
      let lines = appendExtensionLine([], command('/deploy'))
      lines = appendExtensionLine(lines, fail('boom'))
      lines = appendExtensionLine(lines, command('/deploy'))
      lines = appendExtensionLine(lines, fail('boom'))
      expect(counts(lines)).toEqual(['command', 1, 'command', 1])
    })

    it('keeps errors at different places or from different events apart', () => {
      expect(counts(appendExtensionLine([fail('boom', 1)], fail('boom', 2)))).toEqual([1, 1])
      expect(counts(appendExtensionLine([fail('boom')], fail('boom', 0, 'turn_end')))).toEqual([
        1, 1,
      ])
    })
  })

  it('drops them when the session is loaded again', () => {
    expect(hydrateMessages([user('hi')]).extensionLines).toEqual([])
  })
})
