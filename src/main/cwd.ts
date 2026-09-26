import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { SerialQueue } from '@shared/queue'

const locks = new Map<string, SerialQueue>()

export async function projectCwd(cwd: string): Promise<string> {
  const resolved = resolve(cwd)
  try {
    return await realpath(resolved)
  } catch (error) {
    console.error('Failed to resolve project cwd', error)
    return resolved
  }
}

export function withCwdLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const q = locks.get(key) ?? new SerialQueue()
  locks.set(key, q)
  const run = q.enqueue(fn)
  void q.drain().then(() => {
    if (q.pending === 0 && locks.get(key) === q) locks.delete(key)
  })
  return run
}
