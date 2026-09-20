import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'

const tails = new Map<string, Promise<void>>()

export async function projectCwd(cwd: string): Promise<string> {
  const resolved = resolve(cwd)
  try {
    return await realpath(resolved)
  } catch {
    return resolved
  }
}

export function withCwdLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  const tail = run.then(
    () => undefined,
    () => undefined,
  )
  tails.set(key, tail)
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key)
  })
  return run
}

export type Rect = { x: number; y: number; width: number; height: number }

export function clampCascade(from: Rect, workArea: Rect, offset = 24): Rect {
  const width = Math.min(from.width, workArea.width)
  const height = Math.min(from.height, workArea.height)
  const maxX = workArea.x + workArea.width - width
  const maxY = workArea.y + workArea.height - height
  return {
    x: Math.min(Math.max(from.x + offset, workArea.x), maxX),
    y: Math.min(Math.max(from.y + offset, workArea.y), maxY),
    width,
    height,
  }
}
