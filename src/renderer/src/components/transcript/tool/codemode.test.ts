import { describe, expect, it } from 'vitest'
import { resolveToolViewModel } from './model'
import {
  codemodeCallMeta,
  codemodeCallSummary,
  codemodeSummary,
  resolveCodemodeBody,
} from './codemode'

const code =
  'const values = await Promise.all([tools.read({path:"a.txt"}), tools.read({path:"b.txt"})]);\ntext(values);'
const calls = [
  {
    id: 'parent/1',
    name: 'read',
    args: '{"path":"a.txt"}',
    status: 'ok' as const,
    durationMs: 4.2,
  },
  { id: 'parent/2', name: 'read', args: '{"path":"b.txt"}', status: 'ok' as const, durationMs: 8 },
]
const result = {
  content: [
    { type: 'text', text: 'Script completed\nWall time 0.1 seconds\nOutput:\n' },
    { type: 'text', text: 'first output' },
    { type: 'image', data: 'fixture-image', mimeType: 'image/png' },
    { type: 'text', text: 'last output' },
  ],
  details: { calls },
  isError: false,
}

describe('codemode view model', () => {
  it('shows raw JavaScript and ordered output instead of generic JSON', () => {
    const model = resolveToolViewModel({ name: 'codemode', args: { code }, result })
    expect(model.label).toBe('Codemode')
    expect(model.summary).toBe('2 calls')
    expect(model.meta).toBe('100ms')
    expect(model.body).toEqual({
      kind: 'codemode',
      code,
      calls,
      output: [
        { type: 'text', text: 'first output' },
        {
          type: 'image',
          image: { src: 'data:image/png;base64,fixture-image', mimeType: 'image/png' },
        },
        { type: 'text', text: 'last output' },
      ],
      wallTimeMs: 100,
    })
  })

  it('uses the parent live update for running calls and partial script arguments', () => {
    const runningCalls = calls.map((call) => ({
      ...call,
      id: 'parent/?',
      status: 'running' as const,
      durationMs: undefined,
    }))
    const model = resolveToolViewModel({
      name: 'codemode',
      args: { code: '' },
      result,
      live: {
        toolCallId: 'parent',
        toolName: 'codemode',
        args: { code },
        status: 'running',
        partialResult: { content: [], details: { calls: runningCalls } },
      },
    })
    expect(model.running).toBe(true)
    expect(model.summary).toBe('2 calls')
    expect(model.body).toMatchObject({ kind: 'codemode', code, calls: runningCalls, output: [] })
  })

  it('renders live completion and history identically', () => {
    const history = resolveToolViewModel({ name: 'codemode', args: { code }, result })
    const live = resolveToolViewModel({
      name: 'codemode',
      args: { code },
      live: {
        toolCallId: 'parent',
        toolName: 'codemode',
        args: { code },
        status: 'done',
        result,
        partialResult: { content: [], details: { calls: [] } },
      },
    })
    expect(live).toEqual(history)
  })

  it('splits the script error from partial output and drops the call recap', () => {
    const failure = {
      content: [
        { type: 'text', text: 'Script failed\nWall time 0.2 seconds\nOutput:\n' },
        {
          type: 'text',
          text: 'partial output\nScript error:\nError: ENOENT: no such file\n    at read (worker.js:1)\n\nTool calls made before the failure (they are not undone): read (error), read (cancelled)',
        },
      ],
      details: {
        calls: [
          { ...calls[0], status: 'error', error: 'ENOENT' },
          { ...calls[1], status: 'cancelled' },
        ],
      },
      isError: true,
    }
    const model = resolveToolViewModel({
      name: 'codemode',
      args: { code },
      live: {
        toolCallId: 'parent',
        toolName: 'codemode',
        args: { code },
        status: 'done',
        result: failure,
      },
    })
    expect(model.hasError).toBe(false)
    expect(model.summary).toBe('2 calls')
    expect(model.meta).toBe('200ms')
    expect(model.body).toMatchObject({
      kind: 'codemode',
      calls: failure.details.calls,
      output: [{ type: 'text', text: 'partial output' }],
      error: 'Error: ENOENT: no such file\n    at read (worker.js:1)',
    })

    const aborted = resolveCodemodeBody(
      { code },
      {
        content: [
          {
            type: 'text',
            text: 'Script error:\nScript aborted: cancelled\n\nNo tool calls were made.',
          },
        ],
      },
      true,
    )
    expect(aborted.output).toEqual([])
    expect(aborted.error).toBe('Script aborted: cancelled')
    // Successful output that merely mentions the marker is not an error.
    expect(
      resolveCodemodeBody(
        { code },
        { content: [{ type: 'text', text: 'Script error:\nnope' }] },
        false,
      ).error,
    ).toBeUndefined()
  })

  it('handles scripts without nested calls and results without details', () => {
    expect(codemodeSummary([])).toBe('')
    expect(codemodeSummary(calls.slice(0, 1))).toBe('1 call')
    expect(resolveCodemodeBody({ code: 'text(42)' }, undefined, false)).toEqual({
      kind: 'codemode',
      code: 'text(42)',
      calls: [],
      output: [],
    })
    // Arguments still streaming: nothing to show, so the card has no empty panel.
    expect(resolveToolViewModel({ name: 'codemode', args: {}, pending: true }).body).toBeNull()
    expect(resolveCodemodeBody({ code: '   ' }, { content: [], details: {} }, false).code).toBe(
      '   ',
    )
  })

  it('preserves truncation notices and the full output path', () => {
    const text =
      'Warning: truncated output\nhead...tail\n[Full output: /tmp/full.txt (read with offset/limit)]'
    const body = resolveCodemodeBody(
      { code },
      {
        content: [{ type: 'text', text }],
        details: { calls: [], fullOutputPath: '/tmp/full.txt' },
      },
      false,
    )
    expect(body.output).toEqual([{ type: 'text', text }])
  })

  it('hides the leading script header and blank blocks like Pi TUI', () => {
    const header = 'Script failed\nWall time 1.2 seconds\nOutput:\n'
    const content = [
      { type: 'text', text: header },
      { type: 'text', text: '  ' },
      { type: 'text', text: header },
      { type: 'text', text: 'Script error: failed\n' },
    ]
    // Only the leading header is SDK noise; the same text later is script output.
    expect(resolveCodemodeBody({ code }, { content }, true).output).toEqual([
      { type: 'text', text: header.trim() },
      { type: 'text', text: 'Script error: failed' },
    ])
    // Rejected input (e.g. invalid options) has no header and is kept as-is.
    expect(
      resolveCodemodeBody(
        { code },
        { content: [{ type: 'text', text: 'Script completed' }] },
        false,
      ).output,
    ).toEqual([{ type: 'text', text: 'Script completed' }])
  })

  it('splits the error when truncation merged blocks and moved images last', () => {
    const header = { type: 'text', text: 'Script failed\nWall time 0.3 seconds\nOutput:\n' }
    const recap = 'Tool calls made before the failure (they are not undone): read (error)'
    const body = resolveCodemodeBody(
      { code },
      {
        content: [
          header,
          {
            type: 'text',
            text: `head...tail\nScript error:\nError: boom\n\n${recap}\n\n[Full output: /tmp/full.txt (read with offset/limit)]`,
          },
          { type: 'image', data: 'fixture-image', mimeType: 'image/png' },
        ],
      },
      true,
    )
    expect(body.error).toBe('Error: boom')
    expect(body.output).toEqual([
      {
        type: 'text',
        text: 'head...tail\n\n[Full output: /tmp/full.txt (read with offset/limit)]',
      },
      {
        type: 'image',
        image: { src: 'data:image/png;base64,fixture-image', mimeType: 'image/png' },
      },
    ])
  })

  it('treats a rejected codemode call without a script header as the error', () => {
    const body = resolveCodemodeBody(
      { code },
      { content: [{ type: 'text', text: 'Validation failed for tool "codemode"' }] },
      true,
    )
    expect(body.error).toBe('Validation failed for tool "codemode"')
    expect(body.output).toEqual([])
  })

  it('keeps leading indentation of script output', () => {
    const body = resolveCodemodeBody(
      { code },
      { content: [{ type: 'text', text: '  a\n  b\n' }] },
      false,
    )
    expect(body.output).toEqual([{ type: 'text', text: '  a\n  b' }])
  })

  it('formats nested call timing and cost like Pi TUI', () => {
    expect(codemodeCallMeta(calls[0]!)).toBe('4ms')
    expect(codemodeCallMeta({ ...calls[0]!, durationMs: 1500 })).toBe('1.5s')
    expect(codemodeCallMeta({ ...calls[0]!, durationMs: 1240 })).toBe('1.2s')
    expect(codemodeCallMeta({ ...calls[1]!, status: 'cancelled' })).toBe('8ms cancelled')
    expect(codemodeCallMeta({ ...calls[0]!, status: 'error', durationMs: 1 })).toBe('1ms failed')
    expect(codemodeCallMeta({ ...calls[1]!, cost: 0.0042 })).toBe('8ms $0.0042')
    expect(codemodeCallMeta({ ...calls[1]!, durationMs: undefined, status: 'running' })).toBe('')
  })

  it('summarizes nested call args by their main argument', () => {
    const call = { id: 'c/1', name: 'read', status: 'ok' as const }
    expect(
      codemodeCallSummary(
        { ...call, args: '{"path":"/repo/src/a.ts","offset":76,"limit":27}' },
        '/repo',
      ),
    ).toBe('src/a.ts:76:102')
    expect(
      codemodeCallSummary({ ...call, name: 'bash', args: '{"command":"rg \\"x\\" src","tim...' }),
    ).toBe('rg "x" src')
    expect(
      codemodeCallSummary({ ...call, name: 'models.classify', args: '{"labels":["a"]}' }),
    ).toBe('{"labels":["a"]}')
  })
})
