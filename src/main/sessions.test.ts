import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// Not exported from the package root; reached by path to keep `sessionDirOf` in step with the SDK.
import { getDefaultSessionDir } from '../../node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js'
import { describeProject, sessionDirOf, toSessionListItem, withRunning } from './sessions'

describe('toSessionListItem', () => {
  it('serializes Date modified and drops blank name/firstMessage', () => {
    expect(
      toSessionListItem({
        id: 'abc',
        path: '/tmp/abc.jsonl',
        modified: new Date('2026-01-02T03:04:05.000Z'),
        name: '  ',
        firstMessage: '',
        messageCount: 0,
      }),
    ).toEqual({
      id: 'abc',
      path: '/tmp/abc.jsonl',
      modified: '2026-01-02T03:04:05.000Z',
      name: undefined,
      firstMessage: undefined,
      messageCount: 0,
    })
  })

  it('keeps trimmed name and first message', () => {
    const item = toSessionListItem({
      id: 'abc',
      path: '/tmp/abc.jsonl',
      modified: '2026-01-02T03:04:05.000Z',
      name: '  修 bug  ',
      firstMessage: ' help\n',
      messageCount: 4,
    })
    expect(item.name).toBe('修 bug')
    expect(item.firstMessage).toBe('help')
  })
})

describe('withRunning', () => {
  const idle = toSessionListItem({
    id: 'a',
    path: '/tmp/a.jsonl',
    modified: '2026-01-02T03:04:05.000Z',
    messageCount: 1,
  })
  const live = toSessionListItem({
    id: 'b',
    path: '/tmp/b.jsonl',
    modified: '2026-01-02T03:04:05.000Z',
    messageCount: 2,
  })

  it('returns the same list when nothing is running', () => {
    const items = [idle, live]
    expect(withRunning(items, [])).toBe(items)
  })

  it('marks matching paths as running', () => {
    expect(withRunning([idle, live], ['/tmp/b.jsonl'])).toEqual([idle, { ...live, running: true }])
  })

  it('prepends running files that are not on disk yet', () => {
    const next = withRunning([idle], ['/tmp/new.jsonl'])
    expect(next).toHaveLength(2)
    expect(next[0]).toMatchObject({
      path: '/tmp/new.jsonl',
      running: true,
      messageCount: 0,
    })
    expect(next[1]).toBe(idle)
  })
})

describe('sessionDirOf', () => {
  it('matches where the SDK keeps sessions', () => {
    const agentDir = mkdtempSync(join(tmpdir(), 'pi-agent-'))
    expect(sessionDirOf('/Users/me/code/pi', agentDir)).toBe(
      getDefaultSessionDir('/Users/me/code/pi', agentDir),
    )
  })
})

describe('describeProject', () => {
  it('takes the latest change among session files', async () => {
    const agentDir = mkdtempSync(join(tmpdir(), 'pi-agent-'))
    const dir = getDefaultSessionDir('/work/app', agentDir)
    for (const [file, iso] of [
      ['a.jsonl', '2026-01-01T00:00:00.000Z'],
      ['b.jsonl', '2026-03-01T00:00:00.000Z'],
    ]) {
      writeFileSync(join(dir, file), '')
      utimesSync(join(dir, file), new Date(iso), new Date(iso))
    }
    writeFileSync(join(dir, 'notes.txt'), '')

    expect(await describeProject('/work/app', agentDir)).toEqual({
      cwd: '/work/app',
      lastActive: '2026-03-01T00:00:00.000Z',
    })
  })

  it('has no activity for a project never chatted in', async () => {
    const agentDir = mkdtempSync(join(tmpdir(), 'pi-agent-'))
    expect(await describeProject('/work/app', agentDir)).toEqual({
      cwd: '/work/app',
      lastActive: null,
    })
  })
})
