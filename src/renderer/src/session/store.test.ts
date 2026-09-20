import { afterEach, describe, expect, it } from 'vitest'
import { createChatState } from '@/chat/state'
import { useChat } from '@/chat/store'
import type { SessionSnapshot } from '@shared/protocol'
import { applyContextUsage, applyLiveSnapshot, useSession } from './store'

const snapshot: SessionSnapshot = {
  cwd: '/tmp/project',
  state: {
    thinkingLevel: 'off',
    isStreaming: true,
    sessionFile: '/tmp/project/session.jsonl',
    sessionId: 'sess-1',
    messageCount: 1,
    model: { id: 'm', name: 'Model', provider: 'p' },
  },
  messages: [
    {
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello' }],
      timestamp: 2,
    },
  ],
  messagePersistedAt: [2],
  models: [{ id: 'm', name: 'Model', provider: 'p' }],
  thinkingLevels: ['off', 'high'],
  runningSessionFiles: ['/tmp/project/session.jsonl', '/tmp/project/other.jsonl'],
  skills: [{ name: 'tdd', description: 'Test-driven development' }],
  contextUsage: { tokens: 42_500, contextWindow: 256_000, percent: 17 },
}

afterEach(() => {
  useSession.setState({
    lastCwd: null,
    cwd: null,
    sessionId: null,
    sessionFile: null,
    connection: 'disconnected',
    error: null,
    runningSessionFiles: [],
    models: [],
    model: null,
    thinkingLevel: 'off',
    thinkingLevels: [],
    skills: [],
    contextUsage: null,
  })
  useChat.setState(createChatState())
})

describe('applyLiveSnapshot', () => {
  it('restores the live session into renderer stores', () => {
    applyLiveSnapshot(snapshot)
    const session = useSession.getState()
    expect(session.cwd).toBe('/tmp/project')
    expect(session.lastCwd).toBe('/tmp/project')
    expect(session.sessionFile).toBe('/tmp/project/session.jsonl')
    expect(session.sessionId).toBe('sess-1')
    expect(session.connection).toBe('ready')
    expect(session.runningSessionFiles).toEqual([
      '/tmp/project/session.jsonl',
      '/tmp/project/other.jsonl',
    ])
    expect(session.model).toEqual({ id: 'm', name: 'Model', provider: 'p' })
    expect(session.skills).toEqual([{ name: 'tdd', description: 'Test-driven development' }])
    expect(session.contextUsage).toEqual({
      tokens: 42_500,
      contextWindow: 256_000,
      percent: 17,
    })
    const chat = useChat.getState()
    expect(chat.messages).toHaveLength(1)
    expect(chat.isStreaming).toBe(true)
    expect(chat.assistantStreaming).toBe(true)
  })

  it('clears context usage when the snapshot omits it', () => {
    applyLiveSnapshot(snapshot)
    applyLiveSnapshot({ ...snapshot, contextUsage: undefined })
    expect(useSession.getState().contextUsage).toBeNull()
  })
})

describe('applyContextUsage', () => {
  it('updates usage only for the active session', () => {
    applyLiveSnapshot(snapshot)
    applyContextUsage('/tmp/other.jsonl', {
      tokens: 1000,
      contextWindow: 128_000,
      percent: 1,
    })
    expect(useSession.getState().contextUsage).toEqual({
      tokens: 42_500,
      contextWindow: 256_000,
      percent: 17,
    })
    applyContextUsage('/tmp/project/session.jsonl', {
      tokens: null,
      contextWindow: 256_000,
      percent: null,
    })
    expect(useSession.getState().contextUsage).toEqual({
      tokens: null,
      contextWindow: 256_000,
      percent: null,
    })
  })
})
