import { afterEach, describe, expect, it } from 'vitest'
import type { SessionSnapshot } from '@shared/protocol'
import { activeChat, createWindowState } from './state'
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
  skills: [{ name: 'tdd', description: 'Test-driven development' }],
  commands: [],
  ui: { requests: [], state: { statuses: {}, widgets: [] } },
  contextUsage: {
    tokens: 42_500,
    contextWindow: 256_000,
    percent: 17,
    session: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
    compacting: false,
  },
}

afterEach(() => {
  useSession.setState(createWindowState())
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
    expect(session.running).toEqual(['/tmp/project/session.jsonl', '/tmp/project/other.jsonl'])
    expect(session.model).toEqual({ id: 'm', name: 'Model', provider: 'p' })
    expect(session.skills).toEqual([{ name: 'tdd', description: 'Test-driven development' }])
    expect(session.contextUsage).toEqual({
      tokens: 42_500,
      contextWindow: 256_000,
      percent: 17,
      session: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
      compacting: false,
    })
    const chat = activeChat(session)
    expect(chat.messages).toHaveLength(1)
    expect(chat.isStreaming).toBe(true)
    expect(chat.assistantStreaming).toBe(true)
  })

  it('clears context usage when the snapshot omits it', () => {
    applyLiveSnapshot(snapshot)
    applyLiveSnapshot({ ...snapshot, contextUsage: undefined })
    expect(useSession.getState().contextUsage).toBeNull()
  })

  it('manages steering and follow-up queues', async () => {
    const calls: string[] = []
    const mockPi = {
      steer: async (text: string) => {
        calls.push(`steer:${text}`)
      },
      removeSteering: async (index: number) => {
        calls.push(`removeSteering:${index}`)
      },
      followUp: async (text: string) => {
        calls.push(`followUp:${text}`)
      },
      setFollowUpQueue: async (msgs: string[]) => {
        calls.push(`setFollowUpQueue:${msgs.join(',')}`)
      },
      promoteFollowUp: async (index: number) => {
        calls.push(`promoteFollowUp:${index}`)
      },
      clearQueue: async () => {
        calls.push('clearQueue')
        return { steering: [], followUp: [] }
      },
      clearSteeringQueue: async () => {
        calls.push('clearSteeringQueue')
      },
    }
    ;(globalThis as unknown as { window: { pi: unknown } }).window = {
      pi: mockPi,
    }

    applyLiveSnapshot(snapshot)
    const file = '/tmp/project/session.jsonl'

    await useSession.getState().steer('steer message')
    expect(useSession.getState().chats[file]?.steeringQueue).toEqual(['steer message'])
    expect(calls).toContain('steer:steer message')

    await useSession.getState().followUp('follow 1')
    await useSession.getState().followUp('follow 2')
    expect(useSession.getState().chats[file]?.followUpQueue).toEqual(['follow 1', 'follow 2'])

    await useSession.getState().editFollowUp(0, 'follow 1 edited')
    expect(useSession.getState().chats[file]?.followUpQueue).toEqual([
      'follow 1 edited',
      'follow 2',
    ])

    await useSession.getState().moveFollowUp(1, 0)
    expect(useSession.getState().chats[file]?.followUpQueue).toEqual([
      'follow 2',
      'follow 1 edited',
    ])

    await useSession.getState().promoteFollowUpToSteer(0)
    expect(useSession.getState().chats[file]?.followUpQueue).toEqual(['follow 1 edited'])
    expect(calls).toContain('promoteFollowUp:0')

    await useSession.getState().deleteFollowUp(0)
    expect(useSession.getState().chats[file]?.followUpQueue).toEqual([])

    // Test clearSteeringQueue without wiping followUpQueue
    await useSession.getState().followUp('keep me')
    expect(useSession.getState().chats[file]?.steeringQueue).toEqual(['steer message', 'follow 2'])
    expect(useSession.getState().chats[file]?.followUpQueue).toEqual(['keep me'])

    await useSession.getState().clearSteeringQueue()
    expect(useSession.getState().chats[file]?.steeringQueue).toEqual([])
    expect(useSession.getState().chats[file]?.followUpQueue).toEqual(['keep me'])
    expect(calls).toContain('clearSteeringQueue')

    await useSession.getState().clearQueue()
    expect(useSession.getState().chats[file]?.steeringQueue).toEqual([])
    expect(useSession.getState().chats[file]?.followUpQueue).toEqual([])
    expect(calls).toContain('clearQueue')

    mockPi.promoteFollowUp = async () => {
      throw new Error('promote failed')
    }
    await useSession.getState().followUp('keep follow-up')
    await expect(useSession.getState().promoteFollowUpToSteer(0)).rejects.toThrow('promote failed')
    expect(useSession.getState().chats[file]?.followUpQueue).toEqual(['keep follow-up'])
    expect(useSession.getState().chats[file]?.steeringQueue).toEqual([])

    await useSession.getState().steer('cancel me')
    await useSession.getState().removeSteering(0)
    expect(useSession.getState().chats[file]?.steeringQueue).toEqual([])
    expect(calls).toContain('removeSteering:0')
  })

  it('serializes queue operations and preserves later successful updates', async () => {
    let rejectSteer!: (error: Error) => void
    const steerResult = new Promise<void>((_, reject) => {
      rejectSteer = reject
    })
    ;(globalThis as unknown as { window: { pi: unknown } }).window = {
      pi: {
        steer: async () => steerResult,
        followUp: async () => {},
      },
    }
    applyLiveSnapshot(snapshot)
    const file = '/tmp/project/session.jsonl'

    const first = useSession.getState().steer('first')
    const second = useSession.getState().followUp('second')
    rejectSteer(new Error('failed'))

    await expect(first).rejects.toThrow('failed')
    await second
    expect(useSession.getState().chats[file]?.steeringQueue).toEqual([])
    expect(useSession.getState().chats[file]?.followUpQueue).toEqual(['second'])
  })
})

describe('plan review', () => {
  const file = '/tmp/project/session.jsonl'
  const comment = { id: 'c1', text: 'why?', start: 0, end: 5, quote: 'Hello' }
  const draft = { id: 'd1', text: 'typed, not saved', start: 6, end: 11, quote: 'world' }

  function setup(pi: Record<string, unknown>) {
    ;(globalThis as unknown as { window: { pi: unknown } }).window = { pi }
    applyLiveSnapshot({ ...snapshot, state: { ...snapshot.state, isStreaming: false } })
    useSession.setState((state) => ({
      planText: 'Hello world',
      planComments: [comment],
      planDraft: draft,
      chats: { ...state.chats, [file]: { ...activeChat(state), planMode: true } },
    }))
  }

  it('sends the unsaved draft with Build and keeps the review if approval fails', async () => {
    const sent: string[] = []
    setup({
      approvePlan: async (_file: string, message: string) => {
        sent.push(message)
        throw new Error('offline')
      },
    })
    await expect(useSession.getState().approvePlan()).rejects.toThrow('offline')
    expect(sent[0]).toContain('typed, not saved')
    expect(useSession.getState().planComments).toEqual([comment])
    expect(useSession.getState().planDraft).toEqual(draft)
    expect(activeChat(useSession.getState()).planMode).toBe(true)
  })

  it('clears the review only once feedback is sent', async () => {
    setup({
      prompt: async () => {
        throw new Error('offline')
      },
    })
    await expect(useSession.getState().sendPlanFeedback('note')).rejects.toThrow('offline')
    expect(useSession.getState().planComments).toEqual([comment])

    useSession.setState({ send: async () => {} })
    await useSession.getState().sendPlanFeedback('note')
    expect(useSession.getState().planComments).toEqual([])
    expect(useSession.getState().planDraft).toBeNull()
  })

  it('drops the review when Plan Mode is turned off', () => {
    setup({})
    useSession.getState().setPlanMode(false)
    expect(useSession.getState().planComments).toEqual([])
    expect(useSession.getState().planDraft).toBeNull()
  })
})

describe('refreshPlan', () => {
  const file = '/tmp/project/session.jsonl'
  const comment = { id: 'c1', text: 'why?', start: 0, end: 5, quote: 'Hello' }

  function setup(readPlan: (path: string) => Promise<string>, path: string) {
    ;(globalThis as unknown as { window: { pi: unknown } }).window = { pi: { readPlan } }
    applyLiveSnapshot(snapshot)
    useSession.setState((state) => ({
      planComments: [comment],
      chats: { ...state.chats, [file]: { ...activeChat(state), plan: { path, built: false } } },
    }))
  }

  const pointAt = (path: string) =>
    useSession.setState((state) => ({
      chats: { ...state.chats, [file]: { ...activeChat(state), plan: { path, built: false } } },
    }))

  it('keeps comments on the same plan file and drops them for a new one', async () => {
    setup(async () => 'xx Hello', '/plans/a_1.plan.md')
    useSession.setState({ planSource: '/plans/a_1.plan.md' })
    await useSession.getState().refreshPlan()
    expect(useSession.getState().planComments).toEqual([
      { ...comment, start: 3, end: 8, outdated: false },
    ])

    pointAt('/plans/b_2.plan.md')
    await useSession.getState().refreshPlan()
    expect(useSession.getState().planComments).toEqual([])
    expect(useSession.getState().planSource).toBe('/plans/b_2.plan.md')
  })

  it('ignores a slow read of a plan that is no longer current', async () => {
    const pending: Record<string, (text: string) => void> = {}
    setup((path) => new Promise((resolve) => (pending[path] = resolve)), '/plans/a_1.plan.md')
    const first = useSession.getState().refreshPlan()
    pointAt('/plans/b_2.plan.md')
    const second = useSession.getState().refreshPlan()
    pending['/plans/b_2.plan.md']!('plan B')
    await second
    pending['/plans/a_1.plan.md']!('plan A')
    await first
    expect(useSession.getState().planText).toBe('plan B')
    expect(useSession.getState().planSource).toBe('/plans/b_2.plan.md')
  })
})
