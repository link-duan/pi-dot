import { describe, expect, it } from 'vitest'
import { createChatState, type ChatState } from '@/chat/state'
import type { AssistantMessage, SessionEvent, SessionSnapshot } from '@shared/protocol'
import {
  activeChat,
  applyEvent,
  applySnapshot,
  createWindowState,
  parkActive,
  patchChat,
  pendingQuestion,
  pendingUiRequest,
  planCard,
  type WindowState,
} from './state'

const fileA = '/tmp/a.jsonl'
const fileB = '/tmp/b.jsonl'

const assistant = (text: string): AssistantMessage => ({
  role: 'assistant',
  content: [{ type: 'text', text }],
  timestamp: 1,
})

function start(file: string): SessionEvent {
  return { type: 'agent_start', sessionFile: file }
}

function end(file: string, willRetry = false): SessionEvent {
  return { type: 'agent_end', sessionFile: file, willRetry }
}

function windowWith(partial: Partial<WindowState>): WindowState {
  return { ...createWindowState(), ...partial }
}

function snapshot(file: string, extra: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    cwd: '/tmp/project',
    state: {
      thinkingLevel: 'off',
      isStreaming: false,
      sessionFile: file,
      sessionId: 'sess',
      messageCount: 0,
      planMode: false,
      plan: { path: '/plans/a_1.plan.md', built: false },
    },
    messages: [],
    models: [{ id: 'm', name: 'Model', provider: 'p' }],
    thinkingLevels: ['off'],
    runningSessionFiles: [],
    skills: [],
    commands: [],
    trusted: true,
    ui: { requests: [], state: { statuses: {}, widgets: [] } },
    ...extra,
  }
}

describe('applyEvent', () => {
  it('tracks running files and isolates transcript by session', () => {
    let state = windowWith({
      sessionFile: fileB,
      chats: {
        [fileB]: createChatState(),
        [fileA]: { ...createChatState(), isStreaming: true },
      },
    })
    state = applyEvent(state, start(fileA))
    state = applyEvent(state, {
      type: 'message_start',
      sessionFile: fileA,
      message: assistant('hi'),
    })

    expect(state.running).toEqual([fileA])
    expect(state.chats[fileB]?.messages).toHaveLength(0)
    expect(state.chats[fileA]?.messages).toHaveLength(1)

    state = applyEvent(state, end(fileA))
    expect(state.running).toEqual([])
    expect(state.chats[fileA]).toBeUndefined()
    expect(state.chats[fileB]?.messages).toHaveLength(0)
  })

  it('keeps running across a retrying agent_end', () => {
    const state = applyEvent(
      windowWith({
        sessionFile: fileA,
        running: [fileA],
        chats: { [fileA]: { ...createChatState(), isStreaming: true } },
      }),
      end(fileA, true),
    )
    expect(state.running).toEqual([fileA])
    expect(state.chats[fileA]?.isStreaming).toBe(true)
  })

  it('applies the active session to the visible chat', () => {
    const state = applyEvent(
      windowWith({ sessionFile: fileA, chats: { [fileA]: createChatState() } }),
      start(fileA),
    )
    expect(state.running).toEqual([fileA])
    expect(activeChat(state).isStreaming).toBe(true)
  })

  it('updates context usage only for the active session', () => {
    const usage = {
      tokens: 42_500,
      contextWindow: 256_000,
      percent: 17,
      session: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
      compacting: false,
    }
    let state = windowWith({
      sessionFile: fileA,
      contextUsage: usage,
      chats: { [fileA]: createChatState() },
    })
    state = applyEvent(state, {
      type: 'context_usage',
      sessionFile: fileB,
      usage: {
        tokens: 1,
        contextWindow: 128_000,
        percent: 1,
        session: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
        compacting: false,
      },
    })
    expect(state.contextUsage).toEqual(usage)
    state = applyEvent(state, {
      type: 'context_usage',
      sessionFile: fileA,
      usage: {
        tokens: null,
        contextWindow: 256_000,
        percent: null,
        session: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
        compacting: false,
      },
    })
    expect(state.contextUsage).toEqual({
      tokens: null,
      contextWindow: 256_000,
      percent: null,
      session: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
      compacting: false,
    })
  })
})

describe('parkActive', () => {
  it('keeps streaming transcripts and drops idle ones', () => {
    const streaming = parkActive(
      windowWith({
        sessionFile: fileA,
        chats: { [fileA]: { ...createChatState(), isStreaming: true } },
      }),
    )
    expect(streaming.chats[fileA]).toBeDefined()

    const idle = parkActive(
      windowWith({
        sessionFile: fileB,
        chats: { [fileB]: createChatState() },
      }),
    )
    expect(idle.chats[fileB]).toBeUndefined()
  })
})

describe('applySnapshot', () => {
  it('reuses a background transcript when switching to it', () => {
    const cached = {
      ...createChatState(),
      messages: [assistant('streamed')],
      isStreaming: true,
      steeringQueue: ['old steering'],
      followUpQueue: ['old follow-up'],
    }
    let state = windowWith({
      sessionFile: fileA,
      chats: {
        [fileA]: createChatState(),
        [fileB]: cached,
      },
    })
    const nextFile = fileB
    const taken = state.chats[nextFile]
    state = applySnapshot(
      parkActive(state),
      snapshot(fileB, {
        messages: [assistant('disk')],
        steeringQueue: ['new steering'],
        followUpQueue: ['new follow-up'],
      }),
      taken,
    )
    expect(state.sessionFile).toBe(fileB)
    expect(state.chats[fileB]?.messages).toEqual(cached.messages)
    expect(state.chats[fileB]?.steeringQueue).toEqual(['new steering'])
    expect(state.chats[fileB]?.followUpQueue).toEqual(['new follow-up'])
    expect(state.chats[fileA]).toBeUndefined()
  })

  it('restores steering and follow-up queues from snapshot', () => {
    const snap = snapshot(fileA, {
      steeringQueue: ['s1'],
      followUpQueue: ['f1', 'f2'],
    })
    const state = applySnapshot(createWindowState(), snap)
    expect(state.chats[fileA]?.steeringQueue).toEqual(['s1'])
    expect(state.chats[fileA]?.followUpQueue).toEqual(['f1', 'f2'])
  })
})

describe('plan mode', () => {
  it('starts the toggle from the snapshot and keeps a cached local toggle', () => {
    const on = snapshot(fileA)
    on.state.planMode = true
    expect(activeChat(applySnapshot(createWindowState(), on)).planMode).toBe(true)

    const cached = { ...createChatState(), planMode: false }
    expect(activeChat(applySnapshot(createWindowState(), on, cached)).planMode).toBe(false)
  })

  it('takes the mode in effect from the snapshot and plan_mode events', () => {
    const on = snapshot(fileA)
    on.state.planMode = true
    const cached = { ...createChatState(), planActive: false }
    let state = applySnapshot(createWindowState(), on, cached)
    expect(activeChat(state).planActive).toBe(true)
    expect(activeChat(state).plan).toEqual({ path: '/plans/a_1.plan.md', built: false })

    const built = { path: '/plans/a_1.plan.md', built: true }
    state = applyEvent(state, { type: 'plan_mode', sessionFile: fileA, active: false, plan: built })
    expect(activeChat(state).planActive).toBe(false)
    expect(activeChat(state).plan).toEqual(built)
  })

  it('shows the review card for a plan under review, and the read-only pill once built or while revising', () => {
    const base = applySnapshot(createWindowState(), snapshot(fileA))
    const with_ = (planText: string, chat: Partial<ChatState>, planSource = '/plans/a_1.plan.md') =>
      planCard(patchChat({ ...base, planText, planSource }, fileA, chat))
    const plan = { path: '/plans/a_1.plan.md', built: false }
    expect(with_('', { plan, planMode: true })).toBeNull()
    expect(with_('# x', { plan: null, planMode: true })).toBeNull()
    expect(with_('# x', { plan, planMode: true })).toBe('review')
    expect(with_('# x', { plan, planMode: false })).toBeNull()
    expect(with_('# x', { plan, planMode: true, isStreaming: true })).toBe('view')
    expect(with_('# x', { plan: { ...plan, built: true }, planMode: true })).toBe('view')
    expect(with_('# x', { plan: { ...plan, built: true }, planMode: false })).toBe('view')
    // Text still from the previous plan file: nothing until the current one is read.
    expect(with_('# x', { plan, planMode: true }, '/plans/old_2.plan.md')).toBeNull()
  })

  it('drops draft plan comments when switching sessions', () => {
    const comment = { id: 'c', text: 'why?', start: 0, end: 1, quote: 'x' }
    const state = {
      ...applySnapshot(createWindowState(), snapshot(fileA)),
      planComments: [comment],
    }
    expect(applySnapshot(state, snapshot(fileB)).planComments).toEqual([])
  })

  it('keeps the plan review when the same session is reloaded', () => {
    const comment = { id: 'c', text: 'why?', start: 0, end: 1, quote: 'x' }
    const state = {
      ...applySnapshot(createWindowState(), snapshot(fileA)),
      planComments: [comment],
      planViewer: true,
    }
    const reloaded = applySnapshot(state, snapshot(fileA))
    expect(reloaded.planComments).toEqual([comment])
    expect(reloaded.planViewer).toBe(true)
  })

  it('closes the plan viewer when switching sessions', () => {
    const state = { ...applySnapshot(createWindowState(), snapshot(fileA)), planViewer: true }
    expect(applySnapshot(state, snapshot(fileB)).planViewer).toBe(false)
  })
})

describe('pendingQuestion', () => {
  const questions = [{ question: 'Which?', options: [{ label: 'A' }, { label: 'B' }] }]
  const withTools = (toolLive: ChatState['toolLive']) =>
    windowWith({ sessionFile: fileA, chats: { [fileA]: { ...createChatState(), toolLive } } })

  it('is the running ask_user call of the active session', () => {
    const state = withTools({
      read: { toolCallId: 'read', toolName: 'read', args: {}, status: 'running' },
      ask: { toolCallId: 'ask', toolName: 'ask_user', args: { questions }, status: 'running' },
    })
    expect(pendingQuestion(state)).toEqual({ toolCallId: 'ask', questions })
  })

  it('ignores finished calls', () => {
    const state = withTools({
      ask: { toolCallId: 'ask', toolName: 'ask_user', args: { questions }, status: 'done' },
    })
    expect(pendingQuestion(state)).toBeNull()
  })
})

describe('pendingUiRequest', () => {
  it('shows the oldest extension dialog after any waiting question', () => {
    const file = '/tmp/project/session.jsonl'
    let state = applySnapshot(windowWith({}), snapshot(file))
    for (const id of ['a', 'b']) {
      state = applyEvent(state, {
        type: 'ui_request',
        sessionFile: file,
        request: { id, method: 'input', title: id },
      })
    }
    expect(pendingUiRequest(state)).toMatchObject({ request: { id: 'a' }, count: 2 })
    state = applyEvent(state, {
      type: 'tool_execution_start',
      sessionFile: file,
      toolCallId: 'q',
      toolName: 'ask_user',
      args: { questions: [{ question: 'Q?', options: [{ label: 'x' }, { label: 'y' }] }] },
    })
    expect(pendingUiRequest(state)).toBeNull()
  })
})
