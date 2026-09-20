import { mkdtemp, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clampCascade, projectCwd, withCwdLock } from './windows'

describe('projectCwd', () => {
  it('treats a trailing slash as the same folder', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-ui-cwd-'))
    expect(await projectCwd(`${dir}/`)).toBe(await projectCwd(dir))
  })

  it('resolves a symlink to the same folder', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-ui-cwd-'))
    const link = `${dir}-link`
    await symlink(dir, link)
    expect(await projectCwd(link)).toBe(await projectCwd(dir))
  })
})

describe('withCwdLock', () => {
  it('runs waiters on the same key in order', async () => {
    const log: string[] = []
    const first = withCwdLock('k', async () => {
      log.push('a-start')
      await Promise.resolve()
      log.push('a-end')
    })
    const second = withCwdLock('k', async () => {
      log.push('b-start')
      log.push('b-end')
    })
    await Promise.all([first, second])
    expect(log).toEqual(['a-start', 'a-end', 'b-start', 'b-end'])
  })

  it('lets different keys overlap', async () => {
    let releaseA!: () => void
    const aHeld = new Promise<void>((resolve) => {
      releaseA = resolve
    })
    let bRanWhileAHeld = false
    const a = withCwdLock('a', () => aHeld)
    const b = withCwdLock('b', async () => {
      bRanWhileAHeld = true
    })
    await b
    expect(bRanWhileAHeld).toBe(true)
    releaseA()
    await a
  })

  it('releases after a throw so the next waiter runs', async () => {
    await expect(
      withCwdLock('k', async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    let ran = false
    await withCwdLock('k', async () => {
      ran = true
    })
    expect(ran).toBe(true)
  })
})

const screen = { x: 0, y: 25, width: 1440, height: 875 }

describe('clampCascade', () => {
  it('offsets down and right', () => {
    expect(clampCascade({ x: 100, y: 80, width: 960, height: 740 }, screen)).toEqual({
      x: 124,
      y: 104,
      width: 960,
      height: 740,
    })
  })

  it('stays inside the work area', () => {
    expect(clampCascade({ x: 1400, y: 800, width: 960, height: 740 }, screen)).toEqual({
      x: 480,
      y: 160,
      width: 960,
      height: 740,
    })
  })

  it('shrinks when the source is larger than the display', () => {
    expect(clampCascade({ x: 0, y: 25, width: 2000, height: 2000 }, screen)).toEqual({
      x: 0,
      y: 25,
      width: 1440,
      height: 875,
    })
  })
})
