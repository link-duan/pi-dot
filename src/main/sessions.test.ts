import { describe, expect, it } from 'vitest'
import { toSessionListItem } from './sessions'

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
