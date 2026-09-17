import { describe, expect, it } from 'vitest'
import { createChatState } from '@/chat/state'
import type { AssistantMessage, SessionEvent } from '@shared/protocol'
import { applyIncomingEvent, dropIdleChat, stashChat } from './events'

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

function end(file: string): SessionEvent {
  return { type: 'agent_end', sessionFile: file }
}

describe('applyIncomingEvent', () => {
  it('tracks running files and isolates transcript by session', () => {
    const cache = new Map()
    const idle = createChatState()
    stashChat(cache, fileA, { ...createChatState(), isStreaming: true })

    let ctx = applyIncomingEvent(start(fileA), {
      activeFile: fileB,
      running: [],
      activeChat: idle,
      cache,
    })
    ctx = applyIncomingEvent(
      { type: 'message_start', sessionFile: fileA, message: assistant('hi') },
      ctx,
    )

    expect(ctx.running).toEqual([fileA])
    expect(ctx.activeChat.messages).toHaveLength(0)
    expect(cache.get(fileA)?.messages).toHaveLength(1)

    ctx = applyIncomingEvent(end(fileA), ctx)
    expect(ctx.running).toEqual([])
    expect(ctx.activeChat).toBe(idle)
    expect(cache.has(fileA)).toBe(false)
  })

  it('keeps running across a retrying agent_end', () => {
    const ctx = applyIncomingEvent(
      { type: 'agent_end', sessionFile: fileA, willRetry: true },
      {
        activeFile: fileA,
        running: [fileA],
        activeChat: { ...createChatState(), isStreaming: true },
        cache: new Map(),
      },
    )
    expect(ctx.running).toEqual([fileA])
    expect(ctx.activeChat.isStreaming).toBe(true)
  })

  it('applies the active session to the visible chat', () => {
    const ctx = applyIncomingEvent(start(fileA), {
      activeFile: fileA,
      running: [],
      activeChat: createChatState(),
      cache: new Map(),
    })
    expect(ctx.running).toEqual([fileA])
    expect(ctx.activeChat.isStreaming).toBe(true)
  })
})

describe('dropIdleChat', () => {
  it('keeps streaming transcripts and drops idle ones', () => {
    const cache = new Map()
    stashChat(cache, fileA, { ...createChatState(), isStreaming: true })
    stashChat(cache, fileB, createChatState())
    dropIdleChat(cache, fileA)
    dropIdleChat(cache, fileB)
    expect(cache.has(fileA)).toBe(true)
    expect(cache.has(fileB)).toBe(false)
  })
})
