import { describe, expect, it } from 'vitest'
import { toSessionListItem, withRunning } from './sessions'

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
    expect(next[0]).toMatchObject({ path: '/tmp/new.jsonl', running: true, messageCount: 0 })
    expect(next[1]).toBe(idle)
  })
})
