import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThinkingTime } from './thinking-time'

type Handler = (event: unknown) => unknown

function setup() {
  const handlers: Record<string, Handler> = {}
  const thinkingTime = createThinkingTime()
  void thinkingTime.extension({
    on: (name: string, handler: Handler) => {
      handlers[name] = handler
    },
  } as unknown as ExtensionAPI)
  const reply = (content: unknown[]) => ({ role: 'assistant', content, timestamp: 0 }) as never
  const update = (type: string, contentIndex: number) =>
    handlers.message_update!({ assistantMessageEvent: { type, contentIndex } })
  const end = (message: unknown) =>
    (handlers.message_end!({ message }) as { message: unknown } | undefined)?.message
  handlers.message_start!({ message: reply([]) })
  return { thinkingTime, reply, update, end }
}

describe('createThinkingTime', () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }))
  afterEach(() => vi.useRealTimers())

  it('stamps each thinking block with its time, live and when the reply ends', () => {
    const { thinkingTime, reply, update, end } = setup()
    const message = reply([
      { type: 'thinking', thinking: 'a' },
      { type: 'text', text: 'b' },
    ])
    update('thinking_start', 0)
    vi.advanceTimersByTime(1500)
    update('thinking_end', 0)
    vi.advanceTimersByTime(800)

    expect(thinkingTime.stamp(message)).toMatchObject({ content: [{ durationMs: 1500 }, {}] })
    expect(end(message)).toEqual({
      ...(message as object),
      content: [
        { type: 'thinking', thinking: 'a', durationMs: 1500 },
        { type: 'text', text: 'b' },
      ],
    })
  })

  it('ends thinking when a later block starts, for providers that end blocks with the stream', () => {
    const { reply, update, end } = setup()
    update('thinking_start', 0)
    vi.advanceTimersByTime(400)
    update('text_start', 1)
    vi.advanceTimersByTime(900)
    update('thinking_end', 0)
    expect(
      end(
        reply([
          { type: 'thinking', thinking: 'a' },
          { type: 'text', text: 'b' },
        ]),
      ),
    ).toMatchObject({ content: [{ durationMs: 400 }, {}] })
  })

  it('ends an aborted thinking block with the reply', () => {
    const { reply, update, end } = setup()
    update('thinking_start', 0)
    vi.advanceTimersByTime(700)
    expect(end(reply([{ type: 'thinking', thinking: 'a' }]))).toMatchObject({
      content: [{ durationMs: 700 }],
    })
  })

  it('leaves replies without thinking and other messages as they are', () => {
    const { thinkingTime, reply, end } = setup()
    const message = reply([{ type: 'text', text: 'b' }])
    expect(end(message)).toBe(message)
    const user = { role: 'user', content: 'hi', timestamp: 0 } as never
    expect(thinkingTime.stamp(user)).toBe(user)
    expect(end(user)).toBeUndefined()
  })
})
