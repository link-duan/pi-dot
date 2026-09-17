import { describe, expect, it } from 'vitest'
import type { AgentMessage } from './protocol'
import { alignPersistedAt, estimateTurnMs, persistRecordsFromEntries, userTurns } from './turns'

const user = (timestamp: number): AgentMessage => ({ role: 'user', content: 'hi', timestamp })
const assistant = (timestamp: number): AgentMessage => ({
  role: 'assistant',
  content: [{ type: 'text', text: 'ok' }],
  timestamp,
})

describe('userTurns', () => {
  it('groups messages from each user through the next user', () => {
    const messages = [user(1), assistant(2), user(3), assistant(4), assistant(5)]
    expect(userTurns(messages)).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 4 },
    ])
  })
})

describe('alignPersistedAt', () => {
  it('uses entry persist time and falls back to message timestamp', () => {
    const messages = [user(1), assistant(2)]
    expect(
      alignPersistedAt(messages, [
        { role: 'user', messageTimestamp: 1, persistedAt: 10 },
        { role: 'assistant', messageTimestamp: 2, persistedAt: 40 },
      ]),
    ).toEqual([10, 40])
    expect(alignPersistedAt(messages, [])).toEqual([1, 2])
  })
})

describe('persistRecordsFromEntries', () => {
  it('keeps agent messages and parses ISO persist times', () => {
    expect(
      persistRecordsFromEntries([
        {
          type: 'message',
          timestamp: '2024-12-03T14:00:00.000Z',
          message: { role: 'user', content: 'hi', timestamp: 1 },
        },
        { type: 'model_change', timestamp: '2024-12-03T14:00:01.000Z' },
      ]),
    ).toEqual([
      { role: 'user', messageTimestamp: 1, persistedAt: Date.parse('2024-12-03T14:00:00.000Z') },
    ])
  })
})

describe('estimateTurnMs', () => {
  it('hides sub-second turns', () => {
    const messages = [user(1), assistant(2)]
    expect(estimateTurnMs(messages, [1000, 1500], { start: 0, end: 1 })).toBeNull()
    expect(estimateTurnMs(messages, [1000, 4000], { start: 0, end: 1 })).toBe(3000)
  })
})
