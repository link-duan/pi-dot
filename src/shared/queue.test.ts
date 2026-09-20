import { describe, expect, it } from 'vitest'
import { SerialQueue } from './queue'

describe('SerialQueue', () => {
  it('runs waiters in order', async () => {
    const ops = new SerialQueue()
    const log: string[] = []
    const first = ops.enqueue(async () => {
      log.push('a-start')
      await Promise.resolve()
      log.push('a-end')
    })
    const second = ops.enqueue(async () => {
      log.push('b-start')
      log.push('b-end')
    })
    await Promise.all([first, second])
    expect(log).toEqual(['a-start', 'a-end', 'b-start', 'b-end'])
  })

  it('runs the next waiter after a throw', async () => {
    const ops = new SerialQueue()
    await expect(
      ops.enqueue(async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    let ran = false
    await ops.enqueue(async () => {
      ran = true
    })
    expect(ran).toBe(true)
  })

  it('tracks pending while work is queued or running', async () => {
    const ops = new SerialQueue()
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const first = ops.enqueue(() => held)
    const second = ops.enqueue(async () => {})
    expect(ops.pending).toBe(2)
    release()
    await Promise.all([first, second])
    expect(ops.pending).toBe(0)
  })

  it('drain waits for the tail and never rejects', async () => {
    const ops = new SerialQueue()
    const failed = ops.enqueue(async () => {
      throw new Error('boom')
    })
    await expect(ops.drain()).resolves.toBeUndefined()
    await expect(failed).rejects.toThrow('boom')
  })
})
