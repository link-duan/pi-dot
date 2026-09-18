import { afterEach, describe, expect, it } from 'vitest'
import { createChatState } from '@/chat/state'
import { useChat } from '@/chat/store'
import type { SessionSnapshot } from '@shared/protocol'
import { applyLiveSnapshot, useSession } from './store'

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
    const chat = useChat.getState()
    expect(chat.messages).toHaveLength(1)
    expect(chat.isStreaming).toBe(true)
    expect(chat.assistantStreaming).toBe(true)
  })
})
