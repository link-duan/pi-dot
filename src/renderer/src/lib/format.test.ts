import { describe, expect, it } from 'vitest'
import {
  formatRelativeTime,
  sessionTimeGroup,
  formatElapsed,
  sessionTitle,
  formatDiffCopy,
  toolDiffStats,
  toolEditDiff,
  toolLabel,
  toolSummary,
} from './format'

describe('formatElapsed', () => {
  it('uses tenths below one second and whole seconds after', () => {
    expect(formatElapsed(0)).toBe('0.0s')
    expect(formatElapsed(100)).toBe('0.1s')
    expect(formatElapsed(940)).toBe('0.9s')
    expect(formatElapsed(950)).toBe('1s')
    expect(formatElapsed(12_000)).toBe('12s')
    expect(formatElapsed(60_000)).toBe('1m')
    expect(formatElapsed(90_000)).toBe('1m 30s')
    expect(formatElapsed(3_600_000)).toBe('1h')
    expect(formatElapsed(5_412_000)).toBe('1h 30m 12s')
  })
})

describe('sessionTitle', () => {
  it('prefers name over first message', () => {
    expect(sessionTitle({ name: '修登录', firstMessage: '帮我看看' })).toBe('修登录')
  })

  it('uses the first line of the first user message', () => {
    expect(sessionTitle({ firstMessage: '帮我看看\n第二行' })).toBe('帮我看看')
  })

  it('falls back to Empty session', () => {
    expect(sessionTitle({})).toBe('Empty session')
    expect(sessionTitle({ name: '  ', firstMessage: '' })).toBe('Empty session')
  })
})

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-01-02T12:00:00.000Z')

  it('describes recent times compactly', () => {
    expect(formatRelativeTime('2026-01-02T11:59:50.000Z', now)).toBe('Just now')
    expect(formatRelativeTime('2026-01-02T11:50:00.000Z', now)).toBe('10m')
    expect(formatRelativeTime('2026-01-02T09:00:00.000Z', now)).toBe('3h')
    expect(formatRelativeTime('2026-01-01T12:00:00.000Z', now)).toBe('1d')
  })
})

describe('toolSummary', () => {
  it('uses the bash command', () => {
    expect(toolSummary('bash', { command: 'ls -la' })).toBe('ls -la')
  })

  it('uses grep and find patterns', () => {
    expect(toolSummary('grep', { pattern: 'codex-hook|\\.codex' })).toBe('codex-hook|\\.codex')
    expect(toolSummary('find', { pattern: '**/*.ts' })).toBe('**/*.ts')
  })

  it('uses a path relative to cwd for file tools', () => {
    const cwd = '/Users/me/proj'
    const home = '/Users/me'
    expect(toolSummary('edit', { path: '/Users/me/proj/src/a/b.tsx' }, cwd, home)).toBe(
      'src/a/b.tsx',
    )
    expect(toolSummary('write', { path: 'src\\app.ts' }, cwd, home)).toBe('src/app.ts')
    expect(toolSummary('ls', { path: '/Users/me/proj/src' }, cwd, home)).toBe('src')
  })

  it('picks the shorter of relative and ~/ absolute when outside cwd', () => {
    const cwd = '/Users/me/Documents/pi-ui'
    const home = '/Users/me'
    expect(toolSummary('read', { path: '/tmp/notes.md' }, cwd, home)).toBe('/tmp/notes.md')
    expect(toolSummary('read', { path: '/Users/me/.zshrc' }, cwd, home)).toBe('~/.zshrc')
    expect(toolSummary('edit', { path: '/tmp/proj/src/a.ts' }, '/tmp/proj/nested', home)).toBe(
      '../src/a.ts',
    )
  })

  it('appends a line range for read', () => {
    const cwd = '/proj'
    expect(toolSummary('read', { path: '/proj/src/x.ts' }, cwd)).toBe('src/x.ts')
    expect(toolSummary('read', { path: '/proj/src/x.ts', offset: 12 }, cwd)).toBe('src/x.ts:12')
    expect(toolSummary('read', { path: '/proj/src/y.ts', offset: 100, limit: 101 }, cwd)).toBe(
      'src/y.ts:100:200',
    )
    expect(toolSummary('read', { path: '/proj/src/y.ts', limit: 200 }, cwd)).toBe('src/y.ts:1:200')
  })

  it('falls back for unknown tools', () => {
    expect(toolSummary('custom', { command: 'echo hi' })).toBe('echo hi')
    expect(toolSummary('custom', { path: '/tmp/x' })).toBe('/tmp/x')
    expect(toolSummary('bash', null)).toBe('')
  })
})

describe('toolDiffStats', () => {
  it('counts added and removed lines from edit replacements', () => {
    expect(
      toolDiffStats('edit', {
        path: '/proj/a.ts',
        edits: [
          { oldText: '<MarkdownBody text={text} />', newText: '<MarkdownBody\n  text={text}\n/>' },
        ],
      }),
    ).toEqual({ added: 3, removed: 1 })
  })

  it('sums multiple edits and accepts the legacy top-level schema', () => {
    expect(
      toolDiffStats('edit', {
        edits: [
          { oldText: 'a\nb', newText: 'a\nc' },
          { oldText: 'x', newText: 'x\ny' },
        ],
      }),
    ).toEqual({ added: 2, removed: 1 })
    expect(toolDiffStats('edit', { oldText: 'one', newText: 'one\ntwo' })).toEqual({
      added: 1,
      removed: 0,
    })
  })

  it('parses stringified edits arrays', () => {
    expect(
      toolDiffStats('edit', {
        edits: JSON.stringify([{ oldText: 'foo', newText: 'bar' }]),
      }),
    ).toEqual({ added: 1, removed: 1 })
  })

  it('prefers unified patch details over args', () => {
    expect(
      toolDiffStats(
        'edit',
        { edits: [{ oldText: 'a', newText: 'b\nc\nd' }] },
        {
          details: {
            patch: [
              '--- a.ts',
              '+++ a.ts',
              '@@ -1,2 +1,3 @@',
              ' context',
              '-old',
              '+new',
              '+extra',
            ].join('\n'),
          },
        },
      ),
    ).toEqual({ added: 2, removed: 1 })
  })

  it('counts write content as additions', () => {
    expect(toolDiffStats('write', { path: 'a.ts', content: 'one\ntwo\nthree\n' })).toEqual({
      added: 3,
      removed: 0,
    })
  })

  it('returns null when there is nothing to count', () => {
    expect(toolDiffStats('edit', { edits: [{ oldText: 'same', newText: 'same' }] })).toBeNull()
    expect(toolDiffStats('write', { path: 'a.ts', content: '' })).toBeNull()
    expect(toolDiffStats('read', { path: 'a.ts' })).toBeNull()
    expect(toolDiffStats('bash', { command: 'ls' })).toBeNull()
  })
})

describe('toolEditDiff', () => {
  it('keeps shared lines and marks the changed span', () => {
    expect(
      toolEditDiff({
        path: 'a.ts',
        edits: [{ oldText: 'keep\nold\ntail', newText: 'keep\nnew\ntail' }],
      }),
    ).toEqual([
      { kind: 'context', text: 'keep', oldLine: 1, newLine: 1 },
      { kind: 'remove', text: 'old', oldLine: 2 },
      { kind: 'add', text: 'new', newLine: 2 },
      { kind: 'context', text: 'tail', oldLine: 3, newLine: 3 },
    ])
  })

  it('separates multiple edits and accepts the legacy schema', () => {
    expect(
      toolEditDiff({
        edits: [
          { oldText: 'a', newText: 'b' },
          { oldText: 'x', newText: 'x\ny' },
        ],
      }),
    ).toEqual([
      { kind: 'remove', text: 'a', oldLine: 1 },
      { kind: 'add', text: 'b', newLine: 1 },
      { kind: 'context', text: 'x', oldLine: 1, newLine: 1, hunkStart: true },
      { kind: 'add', text: 'y', newLine: 2 },
    ])
    expect(toolEditDiff({ oldText: 'one', newText: 'one\ntwo' })).toEqual([
      { kind: 'context', text: 'one', oldLine: 1, newLine: 1 },
      { kind: 'add', text: 'two', newLine: 2 },
    ])
  })

  it('parses stringified edits arrays', () => {
    expect(toolEditDiff({ edits: JSON.stringify([{ oldText: 'foo', newText: 'bar' }]) })).toEqual([
      { kind: 'remove', text: 'foo', oldLine: 1 },
      { kind: 'add', text: 'bar', newLine: 1 },
    ])
  })

  it('prefers unified patch details and uses hunk line numbers', () => {
    expect(
      toolEditDiff(
        { edits: [{ oldText: 'a', newText: 'b' }] },
        {
          details: {
            patch: [
              '--- a.ts',
              '+++ a.ts',
              '@@ -166,10 +166,10 @@',
              ' context',
              '-old',
              '+new',
            ].join('\n'),
          },
        },
      ),
    ).toEqual([
      { kind: 'context', text: 'context', oldLine: 166, newLine: 166 },
      { kind: 'remove', text: 'old', oldLine: 167 },
      { kind: 'add', text: 'new', newLine: 167 },
    ])
  })

  it('returns null when nothing changed', () => {
    expect(toolEditDiff({ edits: [{ oldText: 'same', newText: 'same' }] })).toBeNull()
  })
})

describe('formatDiffCopy', () => {
  it('rebuilds unified hunks from line numbers', () => {
    expect(
      formatDiffCopy([
        { kind: 'context', text: 'keep', oldLine: 1, newLine: 1 },
        { kind: 'remove', text: 'old', oldLine: 2 },
        { kind: 'add', text: 'new', newLine: 2 },
      ]),
    ).toBe('@@ -1,2 +1,2 @@\n keep\n-old\n+new')
  })
})

describe('toolLabel', () => {
  it('title-cases known tools and keeps unknown names', () => {
    expect(toolLabel('bash')).toBe('Bash')
    expect(toolLabel('custom_tool')).toBe('custom_tool')
  })
})

describe('sessionTimeGroup', () => {
  const now = new Date(2026, 0, 2, 12).getTime()

  it('buckets by calendar day', () => {
    expect(sessionTimeGroup(new Date(2026, 0, 2, 8).toISOString(), now)).toBe('today')
    expect(sessionTimeGroup(new Date(2026, 0, 1, 23).toISOString(), now)).toBe('yesterday')
    expect(sessionTimeGroup(new Date(2025, 11, 28, 12).toISOString(), now)).toBe('week')
    expect(sessionTimeGroup(new Date(2025, 11, 1, 12).toISOString(), now)).toBe('older')
  })
})
