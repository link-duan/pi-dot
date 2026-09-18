import { describe, expect, it } from 'vitest'
import type { AssistantMessage, SessionEvent } from '@shared/protocol'
import { createReplayBuffer, replayQueuedEvent, resolveQueuedStatus } from './ipc'

const file = '/tmp/session.jsonl'

const assistant = (text: string): AssistantMessage => ({
  role: 'assistant',
  content: [{ type: 'text', text }],
  timestamp: 2,
})

describe('createReplayBuffer', () => {
  it('holds items until flush, then delivers live', () => {
    const buffer = createReplayBuffer<number>()
    const received: number[] = []
    buffer.push(1, (item) => received.push(item))
    buffer.push(2, (item) => received.push(item))
    expect(received).toEqual([])
    buffer.flush((item) => received.push(item))
    expect(received).toEqual([1, 2])
    buffer.push(3, (item) => received.push(item))
    expect(received).toEqual([1, 2, 3])
  })
})

describe('replayQueuedEvent', () => {
  it('drops agent_start for the active streaming session', () => {
    const event: SessionEvent = { type: 'agent_start', sessionFile: file }
    expect(
      replayQueuedEvent(event, {
        sessionFile: file,
        isStreaming: true,
        lastMessage: assistant('Hi'),
      }),
    ).toBeNull()
  })

  it('keeps agent_start for another session', () => {
    const event: SessionEvent = { type: 'agent_start', sessionFile: '/tmp/other.jsonl' }
    expect(replayQueuedEvent(event, { sessionFile: file, isStreaming: true })).toEqual(event)
  })

  it('turns a snapshot-included message_start into an update', () => {
    const message = assistant('Hello')
    const event: SessionEvent = { type: 'message_start', sessionFile: file, message }
    expect(
      replayQueuedEvent(event, { sessionFile: file, isStreaming: true, lastMessage: message }),
    ).toEqual({
      ...event,
      type: 'message_update',
    })
  })

  it('keeps message_start when the last message is a different identity', () => {
    const event: SessionEvent = {
      type: 'message_start',
      sessionFile: file,
      message: { ...assistant('Next'), timestamp: 3 },
    }
    expect(
      replayQueuedEvent(event, {
        sessionFile: file,
        isStreaming: true,
        lastMessage: assistant('Hello'),
      }),
    ).toEqual(event)
  })
})

describe('resolveQueuedStatus', () => {
  it('reattaches when ready arrives before cwd is hydrated', () => {
    expect(resolveQueuedStatus('ready', null)).toBe('attach')
  })

  it('does not clobber a hydrated session with connecting or ready', () => {
    expect(resolveQueuedStatus('connecting', '/tmp/project')).toBe('ignore')
    expect(resolveQueuedStatus('ready', '/tmp/project')).toBe('ignore')
  })

  it('still applies error and disconnected', () => {
    expect(resolveQueuedStatus('error', '/tmp/project')).toBe('apply')
    expect(resolveQueuedStatus('disconnected', '/tmp/project')).toBe('apply')
    expect(resolveQueuedStatus('connecting', null)).toBe('apply')
  })
})
