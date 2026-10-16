import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoop } from './loop'

type Handler = (event: unknown, ctx: unknown) => unknown
type Tool = { name: string; execute: (id: string, params: unknown) => Promise<unknown> }

function fakePi() {
  const handlers: Record<string, Handler> = {}
  const tools: Record<string, Tool> = {}
  let active = ['read']
  const sent: string[] = []
  const messages: Array<{ message: { content: string }; options?: unknown }> = []
  const pi = {
    on: (name: string, handler: Handler) => {
      handlers[name] = handler
    },
    registerTool: (tool: Tool) => {
      tools[tool.name] = tool
    },
    getActiveTools: () => active,
    setActiveTools: (names: string[]) => {
      active = names
    },
    sendUserMessage: (text: string) => sent.push(text),
    sendMessage: (message: { content: string }, options?: unknown) =>
      messages.push({ message, options }),
  }
  const emit = (name: string, event: unknown = {}) => handlers[name]?.(event, {})
  /** Starts a run; returns the reminder it injects, if any. */
  const run = (event: unknown) => {
    const result = emit('before_agent_start', event) as { message: { content: string } } | undefined
    emit('agent_start')
    return result?.message.content
  }
  return {
    pi: pi as unknown as ExtensionAPI,
    sent,
    messages,
    activeTools: () => active,
    emit,
    wakeup: (params: unknown) => tools.schedule_wakeup!.execute('call', params),
    start: (prompt: string) => run({ messageType: 'user', prompt }),
    /** Starts the run a sent custom message triggers. */
    startSent: () =>
      run({ messageType: 'custom', message: { role: 'custom', ...messages.at(-1)!.message } }),
    end: () => emit('agent_settled', { aborted: false }),
  }
}

describe('createLoop', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  async function started() {
    const loop = createLoop()
    const fake = fakePi()
    await loop.extension(fake.pi)
    fake.emit('session_start')
    return { loop, fake }
  }

  it('keeps schedule_wakeup declared and rejects it outside a self-paced loop', async () => {
    const { loop, fake } = await started()
    expect(fake.activeTools()).toEqual(['read', 'schedule_wakeup'])
    await expect(fake.wakeup({ delaySeconds: 60 })).rejects.toThrow('No self-paced loop')
    loop.set({ prompt: 'check', ms: 60_000 })
    await expect(fake.wakeup({ delaySeconds: 60 })).rejects.toThrow('No self-paced loop')
  })

  it('repeats a fixed loop without reminders once idle for the interval', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check CI', ms: 300_000 })
    expect(fake.sent).toEqual(['check CI'])
    expect(fake.start('check CI')).toBeUndefined()
    fake.end()
    expect(loop.ref?.nextAt).toBe(Date.now() + 300_000)
    vi.advanceTimersByTime(299_999)
    expect(fake.sent).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(fake.sent).toHaveLength(2)
  })

  it('restarts the wait when another run starts', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check', ms: 60_000 })
    fake.start('check')
    fake.end()
    vi.advanceTimersByTime(30_000)
    fake.emit('agent_start')
    expect(loop.ref?.nextAt).toBeNull()
    vi.advanceTimersByTime(60_000)
    expect(fake.sent).toHaveLength(1)
  })

  it('starts the first iteration once a going run settles', async () => {
    const { loop, fake } = await started()
    fake.start('chat')
    loop.set({ prompt: 'check CI', ms: null })
    expect(fake.sent).toEqual([])
    fake.end()
    expect(fake.sent).toEqual(['check CI'])
    expect(fake.start('check CI')).toContain('schedule_wakeup')
  })

  it('waits for a run to settle, so a failed run that retries keeps the loop', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check CI', ms: null })
    fake.start('check CI')
    fake.emit('agent_end', { messages: [] })
    fake.emit('agent_start')
    expect(loop.ref).not.toBeNull()
    await fake.wakeup({ delaySeconds: 120 })
    fake.end()
    expect(loop.ref?.nextAt).toBe(Date.now() + 120_000)
  })

  it('does not take the user typing the loop prompt for an iteration', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check CI', ms: null })
    fake.start('check CI')
    await fake.wakeup({ delaySeconds: 120 })
    fake.end()
    expect(fake.start('check CI')).toBeUndefined()
    fake.end()
    expect(loop.ref).not.toBeNull()
  })

  it('reminds every self-paced iteration and repeats at the delay picked, clamped', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check CI', ms: null })
    expect(fake.start('check CI')).toBeDefined()
    await fake.wakeup({ delaySeconds: 5, reason: 'soon' })
    expect(loop.ref).toMatchObject({ ms: 60_000, reason: 'soon' })
    fake.end()
    vi.advanceTimersByTime(60_000)
    expect(fake.sent).toEqual(['check CI', 'check CI'])
    expect(fake.start('check CI')).toBeDefined()
  })

  it('ends a self-paced loop when an iteration does not re-arm', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check CI', ms: null })
    fake.start('check CI')
    fake.end()
    expect(loop.ref).toBeNull()
    vi.advanceTimersByTime(3_600_000)
    expect(fake.sent).toHaveLength(1)
  })

  it('keeps a self-paced loop through a message the user writes in between', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check CI', ms: null })
    fake.start('check CI')
    await fake.wakeup({ delaySeconds: 120 })
    fake.end()
    expect(fake.start('and the logs?')).toBeUndefined()
    fake.end()
    vi.advanceTimersByTime(120_000)
    expect(fake.sent).toEqual(['check CI', 'check CI'])
  })

  it('ends with stop: true or set(null)', async () => {
    const { loop, fake } = await started()
    const changes = vi.fn()
    loop.onChange(changes)

    loop.set({ prompt: 'check CI', ms: null })
    fake.start('check CI')
    await expect(fake.wakeup({})).rejects.toThrow('delaySeconds is required')
    await fake.wakeup({ stop: true })
    fake.end()
    expect(loop.ref).toBeNull()
    expect(changes).toHaveBeenLastCalledWith(null)

    loop.set({ prompt: 'check', ms: 60_000 })
    fake.start('check')
    fake.end()
    loop.set(null)
    vi.advanceTimersByTime(60_000)
    expect(loop.ref).toBeNull()
    expect(fake.sent).toEqual(['check CI', 'check'])
  })

  it('runs a waiting loop at once with its changed prompt, then keeps its interval', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check CI', ms: 60_000 })
    fake.start('check CI')
    fake.end()
    loop.edit('check CI and deploy')
    expect(loop.ref?.prompt).toBe('check CI and deploy')
    expect(fake.messages).toEqual([
      {
        message: expect.objectContaining({
          content: "<loop>\nThe user changed this loop's prompt to:\ncheck CI and deploy\n</loop>",
          details: { edited: true },
        }),
        options: { triggerTurn: true },
      },
    ])
    fake.startSent()
    expect(loop.ref?.nextAt).toBeNull()
    vi.advanceTimersByTime(30_000)
    fake.end()
    vi.advanceTimersByTime(59_999)
    expect(fake.sent).toEqual(['check CI'])
    vi.advanceTimersByTime(1)
    expect(fake.sent).toEqual(['check CI', 'check CI and deploy'])
  })

  it('reminds the run a self-paced prompt change starts, which ends the loop unless it re-arms', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check CI', ms: null })
    fake.start('check CI')
    await fake.wakeup({ delaySeconds: 600 })
    fake.end()
    loop.edit('check CI and deploy')
    expect(fake.startSent()).toContain('schedule_wakeup')
    fake.end()
    expect(loop.ref).toBeNull()
  })

  it('holds prompt changes made during a run as one, sent once the run settles', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check CI', ms: 60_000 })
    fake.start('check CI')
    loop.edit('check CI and deploy')
    loop.edit('check CI and deploy to staging')
    expect(loop.ref).toMatchObject({ prompt: 'check CI and deploy to staging', editPending: true })
    expect(fake.messages).toEqual([])
    fake.end()
    expect(fake.messages).toEqual([
      {
        message: expect.objectContaining({ content: expect.stringContaining('to staging') }),
        options: { triggerTurn: true },
      },
    ])
    expect(loop.ref?.editPending).toBe(true)
    fake.emit('message_start', { message: { role: 'custom', ...fake.messages[0]!.message } })
    expect(loop.ref?.editPending).toBe(false)
  })

  it('ignores a prompt change without a loop', async () => {
    const { loop, fake } = await started()
    loop.edit('check CI')
    expect(loop.ref).toBeNull()
    expect(fake.messages).toEqual([])
  })

  it('keeps what a failed run scheduled through its retry', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check CI', ms: null })
    fake.start('check CI')
    await fake.wakeup({ delaySeconds: 120 })
    fake.emit('agent_end', { messages: [] })
    fake.emit('agent_start')
    fake.end()
    expect(loop.ref?.nextAt).toBe(Date.now() + 120_000)
  })

  it('sends a first prompt changed before it went out as the prompt, not as a change', async () => {
    const { loop, fake } = await started()
    fake.start('chat')
    loop.set({ prompt: 'check CI', ms: 60_000 })
    loop.edit('check CI and deploy')
    expect(loop.ref?.editPending).toBe(false)
    fake.end()
    expect(fake.sent).toEqual(['check CI and deploy'])
    expect(fake.messages).toEqual([])
  })

  it('drops a held prompt change when a new loop replaces it', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check CI', ms: 60_000 })
    fake.start('check CI')
    loop.edit('check CI and deploy')
    loop.set({ prompt: 'watch logs', ms: 60_000 })
    expect(loop.ref?.editPending).toBe(false)
    fake.end()
    expect(fake.sent).toEqual(['check CI', 'watch logs'])
    expect(fake.messages).toEqual([])
  })

  it('shows only what the loop is, not how it runs', async () => {
    const { loop, fake } = await started()
    loop.set({ prompt: 'check CI', ms: 60_000 })
    fake.start('check CI')
    fake.end()
    expect(loop.ref).toEqual({
      prompt: 'check CI',
      ms: 60_000,
      fixed: true,
      reason: undefined,
      nextAt: Date.now() + 60_000,
      editPending: false,
    })
  })
})
