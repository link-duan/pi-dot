import { describe, expect, it } from 'vitest'
import {
  formatDiffCopy,
  toolDiffStats,
  toolEditDiff,
  toolWriteDiff,
} from '@/components/transcript/tool/diff'
import { extractToolImages, resolveToolImageText } from '@/components/transcript/tool/images'
import { isCollapsedToolAttempt, toolLabel } from '@/components/transcript/tool/kind'
import {
  formatElapsed,
  formatMessageTime,
  formatRelativeTime,
  formatTokenCount,
  sessionTimeGroup,
  sessionTitle,
  sessionTitleSegments,
  toolReadPreview,
  toolSummary,
} from './format'

describe('formatTokenCount', () => {
  it('uses raw counts below one thousand and compact K/M after', () => {
    expect(formatTokenCount(0)).toBe('0')
    expect(formatTokenCount(999)).toBe('999')
    expect(formatTokenCount(1000)).toBe('1K')
    expect(formatTokenCount(1500)).toBe('1.5K')
    expect(formatTokenCount(42_500)).toBe('42.5K')
    expect(formatTokenCount(256_000)).toBe('256K')
    expect(formatTokenCount(1_000_000)).toBe('1M')
    expect(formatTokenCount(1_200_000)).toBe('1.2M')
  })
})

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

  it('projects a skill block into a /skill token plus remaining text', () => {
    const firstMessage = [
      '<skill name="tdd" location="/tmp/tdd/SKILL.md">',
      'Write tests first.',
      '</skill>',
      '',
      'fix the failing test',
    ].join('\n')
    expect(sessionTitle({ firstMessage })).toBe('/skill:tdd fix the failing test')
    expect(sessionTitleSegments({ firstMessage })).toEqual([
      { type: 'skill', name: 'tdd' },
      { type: 'text', text: 'fix the failing test' },
    ])
  })

  it('keeps a skill-only first message as a chip', () => {
    const firstMessage = '<skill name="grill-me" location="/tmp/grill-me/SKILL.md">\nbody\n</skill>'
    expect(sessionTitle({ firstMessage })).toBe('/skill:grill-me')
    expect(sessionTitleSegments({ firstMessage })).toEqual([{ type: 'skill', name: 'grill-me' }])
  })

  it('uses the first line of remaining text after a skill block', () => {
    const firstMessage = [
      '<skill name="tdd" location="/tmp/tdd/SKILL.md">',
      'body',
      '</skill>',
      '',
      'line one',
      'line two',
    ].join('\n')
    expect(sessionTitle({ firstMessage })).toBe('/skill:tdd line one')
  })

  it('projects inline skill and file tokens', () => {
    expect(sessionTitle({ firstMessage: 'use /skill:tdd on @file:src/foo.ts:10-20' })).toBe(
      'use /skill:tdd on @file:src/foo.ts:10-20',
    )
    expect(
      sessionTitleSegments({ firstMessage: 'use /skill:tdd on @file:src/foo.ts:10-20' }),
    ).toEqual([
      { type: 'text', text: 'use ' },
      { type: 'skill', name: 'tdd' },
      { type: 'text', text: ' on ' },
      { type: 'file', path: 'src/foo.ts', range: { start: 10, end: 20 } },
    ])
  })
})

describe('formatMessageTime', () => {
  const now = new Date(2026, 8, 20, 18, 0).getTime()

  it('shows HH:mm on the same calendar day', () => {
    expect(formatMessageTime(new Date(2026, 8, 20, 14, 32).getTime(), now)).toBe('14:32')
    expect(formatMessageTime(new Date(2026, 8, 20, 0, 5).getTime(), now)).toBe('00:05')
  })

  it('includes the month when the day differs', () => {
    expect(formatMessageTime(new Date(2026, 8, 19, 9, 5).getTime(), now)).toBe('Sep 19, 09:05')
  })

  it('includes the year when it differs', () => {
    expect(formatMessageTime(new Date(2024, 0, 1, 8, 0).getTime(), now)).toBe('Jan 1, 2024, 08:00')
  })

  it('returns empty for invalid timestamps', () => {
    expect(formatMessageTime(Number.NaN, now)).toBe('')
    expect(formatMessageTime(Number.POSITIVE_INFINITY, now)).toBe('')
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

describe('toolReadPreview', () => {
  const cwd = '/proj'
  const home = '/Users/me'

  it('returns file text with a cwd-relative path', () => {
    expect(
      toolReadPreview(
        { path: '/proj/src/x.ts' },
        { content: [{ type: 'text', text: 'export const n = 1\n' }] },
        cwd,
        home,
      ),
    ).toEqual({
      kind: 'code',
      path: 'src/x.ts',
      code: 'export const n = 1\n',
      startLine: 1,
    })
  })

  it('uses offset as the starting line', () => {
    expect(
      toolReadPreview({ path: 'a.ts', offset: 12, limit: 4 }, { content: 'keep\nthis' }, cwd),
    ).toEqual({
      kind: 'code',
      path: 'a.ts',
      code: 'keep\nthis',
      startLine: 12,
    })
  })

  it('strips the continuation notice and keeps in-body brackets', () => {
    expect(
      toolReadPreview(
        { path: 'a.ts' },
        {
          content: [
            {
              type: 'text',
              text: 'const tags = ["[keep]"]\n\n[Showing lines 1-2 of 9. Use offset=3 to continue.]',
            },
          ],
        },
      ),
    ).toEqual({
      kind: 'code',
      path: 'a.ts',
      code: 'const tags = ["[keep]"]',
      startLine: 1,
      notice: '[Showing lines 1-2 of 9. Use offset=3 to continue.]',
    })
    expect(
      toolReadPreview(
        { path: 'a.ts' },
        'line\n\n[3 more lines in file. Use offset=2 to continue.]',
      ),
    ).toEqual({
      kind: 'code',
      path: 'a.ts',
      code: 'line',
      startLine: 1,
      notice: '[3 more lines in file. Use offset=2 to continue.]',
    })
  })

  it('returns null for missing results, images without data, and oversize lines', () => {
    expect(toolReadPreview({ path: 'a.ts' }, null)).toBeNull()
    expect(toolReadPreview({ path: 'a.ts' }, undefined)).toBeNull()
    expect(toolReadPreview(null, 'hello')).toBeNull()
    expect(toolReadPreview({ path: 'pic.png' }, 'Read image file [image/png]')).toBeNull()
    expect(
      toolReadPreview(
        { path: '/proj/assets/icon.png' },
        {
          content: [
            { type: 'text', text: 'Read image file [image/png]' },
            { type: 'image', data: 'iVBORw0KGgoAAAANSUhEUg==', mimeType: 'image/png' },
          ],
        },
        cwd,
        home,
      ),
    ).toBeNull()
    expect(
      toolReadPreview(
        { path: 'a.ts' },
        "[Line 1 is 80.0KB, exceeds 64.0KB limit. Use bash: sed -n '1p' a.ts]",
      ),
    ).toBeNull()
  })

  it('keeps an empty file as a preview', () => {
    expect(
      toolReadPreview({ path: '/proj/empty.ts' }, { content: [{ type: 'text', text: '' }] }, cwd),
    ).toEqual({
      kind: 'code',
      path: 'empty.ts',
      code: '',
      startLine: 1,
    })
  })
})

describe('extractToolImages', () => {
  it('returns empty array when result has no images', () => {
    expect(extractToolImages(null)).toEqual([])
    expect(extractToolImages('hello')).toEqual([])
    expect(extractToolImages({ content: [{ type: 'text', text: 'no image' }] })).toEqual([])
  })

  it('extracts image from direct block and content array', () => {
    expect(extractToolImages({ type: 'image', data: 'abc==', mimeType: 'image/webp' })).toEqual([
      { src: 'data:image/webp;base64,abc==', mimeType: 'image/webp' },
    ])
    expect(
      extractToolImages({
        content: [{ type: 'image', data: 'def==', mimeType: 'image/jpeg' }],
      }),
    ).toEqual([{ src: 'data:image/jpeg;base64,def==', mimeType: 'image/jpeg' }])
  })

  it('extracts images nested inside MCP details.raw.content', () => {
    const mcpRes = {
      role: 'toolResult',
      toolName: 'figma_get_screenshot',
      content: [{ type: 'text', text: '[image content: image/png]' }],
      details: {
        raw: {
          content: [{ type: 'image', data: 'mcpImageBase64', mimeType: 'image/png' }],
        },
      },
    }
    const extracted = extractToolImages(mcpRes)
    expect(extracted).toEqual([
      { src: 'data:image/png;base64,mcpImageBase64', mimeType: 'image/png' },
    ])
  })

  it('extracts multiple images from any tool result', () => {
    const res = {
      content: [
        { type: 'text', text: 'screenshots' },
        { type: 'image', data: 'img1', mimeType: 'image/png' },
        { type: 'image', data: 'img2', mimeType: 'image/png' },
      ],
    }
    const extracted = extractToolImages(res)
    expect(extracted).toHaveLength(2)
    expect(extracted[0].src).toBe('data:image/png;base64,img1')
    expect(extracted[1].src).toBe('data:image/png;base64,img2')
  })
})

describe('resolveToolImageText', () => {
  it('extracts notice hints for read tool and drops boilerplate header', () => {
    expect(
      resolveToolImageText('read', {
        content: [
          {
            type: 'text',
            text: 'Read image file [image/png]\n[Image resized from 200x200 to 100x100.]',
          },
        ],
      }),
    ).toEqual({
      notice: '[Image resized from 200x200 to 100x100.]',
      description: undefined,
    })

    expect(
      resolveToolImageText('read', {
        content: [
          {
            type: 'text',
            text: 'Read image file [image/png]\n[Image: original 2656x2076, displayed at 2000x1563. Multiply coordinates by 1.33 to map to original image.]',
          },
        ],
      }),
    ).toEqual({
      notice:
        '[Image: original 2656x2076, displayed at 2000x1563. Multiply coordinates by 1.33 to map to original image.]',
      description: undefined,
    })

    expect(
      resolveToolImageText('read', {
        content: [{ type: 'text', text: 'Read image file [image/png]' }],
      }),
    ).toEqual({
      notice: undefined,
      description: undefined,
    })
  })

  it('drops MCP placeholder and extracts real description for other tools', () => {
    expect(
      resolveToolImageText('figma_get_screenshot', {
        content: [{ type: 'text', text: '[image content: image/png]' }],
      }),
    ).toEqual({
      notice: undefined,
      description: undefined,
    })

    expect(
      resolveToolImageText('figma_get_screenshot', {
        content: [{ type: 'text', text: 'Screenshot of canvas\nFound 2 issues' }],
      }),
    ).toEqual({
      notice: undefined,
      description: 'Screenshot of canvas\nFound 2 issues',
    })
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

describe('toolWriteDiff', () => {
  it('treats every content line as an addition', () => {
    expect(toolWriteDiff({ path: 'a.ts', content: 'one\ntwo\n' })).toEqual([
      { kind: 'add', text: 'one', newLine: 1 },
      { kind: 'add', text: 'two', newLine: 2 },
    ])
  })

  it('returns null when there is no content', () => {
    expect(toolWriteDiff({ path: 'a.ts', content: '' })).toBeNull()
    expect(toolWriteDiff({ path: 'a.ts' })).toBeNull()
    expect(toolWriteDiff(null)).toBeNull()
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

describe('isCollapsedToolAttempt', () => {
  it('collapses failed edit and write calls', () => {
    expect(isCollapsedToolAttempt('edit', true)).toBe(true)
    expect(isCollapsedToolAttempt('Write', true)).toBe(true)
    expect(isCollapsedToolAttempt('edit', false)).toBe(false)
    expect(isCollapsedToolAttempt('bash', true)).toBe(false)
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
