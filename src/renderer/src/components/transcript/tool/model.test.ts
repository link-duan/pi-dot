import { describe, expect, it } from 'vitest'
import { isImageFile } from '@/lib/path'
import { resolveToolViewModel } from './model'

describe('resolveToolViewModel', () => {
  const cwd = '/workspace/project'
  const homedir = '/Users/test'

  it('resolves diff model for edit tool', () => {
    const model = resolveToolViewModel({
      name: 'edit',
      args: { path: 'src/app.ts', oldText: 'hello', newText: 'world' },
      cwd,
      homedir,
    })
    expect(model.body?.kind).toBe('diff')
    if (model.body?.kind === 'diff') {
      expect(model.body.path).toBe('src/app.ts')
      expect(model.body.lines).toHaveLength(2)
      expect(model.body.stats).toEqual({ added: 1, removed: 1 })
    }
    expect(model.hideMetaWhenOpen).toBe(true)
  })

  it('resolves diff model for write tool', () => {
    const model = resolveToolViewModel({
      name: 'write',
      args: { path: 'src/new.ts', content: 'line1\nline2' },
      cwd,
      homedir,
    })
    expect(model.body?.kind).toBe('diff')
    if (model.body?.kind === 'diff') {
      expect(model.body.path).toBe('src/new.ts')
      expect(model.body.lines).toHaveLength(2)
      expect(model.body.stats).toEqual({ added: 2, removed: 0 })
    }
  })

  it('resolves images model for any tool returning image content', () => {
    // MCP tool like figma_get_screenshot
    const model = resolveToolViewModel({
      name: 'figma_get_screenshot',
      args: { nodeId: '1738:117717' },
      result: {
        content: [{ type: 'text', text: '[image content: image/png]' }],
        details: {
          raw: {
            content: [{ type: 'image', data: 'abc123base64', mimeType: 'image/png' }],
          },
        },
      },
      cwd,
      homedir,
    })
    expect(model.body?.kind).toBe('images')
    expect(model.summary).toBe('1738:117717')
    expect(model.hideMetaWhenOpen).toBe(true)
    if (model.body?.kind === 'images') {
      expect(model.body.images).toHaveLength(1)
      expect(model.body.images[0].src).toBe('data:image/png;base64,abc123base64')
      expect(model.body.images[0].title).toBe('1738:117717')
      expect(model.body.notice).toBeUndefined() // filtered [image content: ...]
      expect(model.body.argsText).toBeUndefined() // redundant single-key arg is omitted
    }
  })

  it('resolves images model for read tool on image files', () => {
    const model = resolveToolViewModel({
      name: 'read',
      args: { path: 'assets/logo.png' },
      result: {
        content: [
          {
            type: 'text',
            text: 'Read image file [image/png]\n[Image resized from 500x500 to 250x250.]',
          },
          { type: 'image', data: 'logobase64', mimeType: 'image/png' },
        ],
      },
      cwd,
      homedir,
    })
    expect(model.body?.kind).toBe('images')
    if (model.body?.kind === 'images') {
      expect(model.body.images[0].path).toBe('assets/logo.png')
      expect(model.body.notice).toBe('[Image resized from 500x500 to 250x250.]')
      expect(model.body.argsText).toBeUndefined()
    }
  })

  it('keeps argsText when arguments contain multiple fields', () => {
    const model = resolveToolViewModel({
      name: 'figma_get_screenshot',
      args: { nodeId: '1738:117717', scale: 2 },
      result: {
        content: [{ type: 'image', data: 'img', mimeType: 'image/png' }],
      },
      cwd,
      homedir,
    })
    expect(model.body?.kind).toBe('images')
    if (model.body?.kind === 'images') {
      expect(model.body.argsText).toBeDefined()
    }
  })

  it('recognizes image file paths even with line range suffixes', () => {
    expect(isImageFile('photo.png:1:20')).toBe(true)
    expect(isImageFile('screenshot.jpg:15')).toBe(true)
    expect(isImageFile('code.ts:1:20')).toBe(false)
  })

  it('preserves text description when a tool returns both text and image', () => {
    const model = resolveToolViewModel({
      name: 'screenshot_analyzer',
      args: { view: 'desktop' },
      result: {
        content: [
          { type: 'text', text: 'Here is the rendered layout.' },
          { type: 'image', data: 'imgbase64', mimeType: 'image/png' },
        ],
      },
      cwd,
      homedir,
    })
    expect(model.body?.kind).toBe('images')
    if (model.body?.kind === 'images') {
      expect(model.body.description).toBe('Here is the rendered layout.')
      expect(model.body.images).toHaveLength(1)
    }
  })

  it('resolves code model for read tool on text files', () => {
    const model = resolveToolViewModel({
      name: 'read',
      args: { path: 'src/code.ts' },
      result: { content: [{ type: 'text', text: 'const a = 1;' }] },
      cwd,
      homedir,
    })
    expect(model.body?.kind).toBe('code')
    if (model.body?.kind === 'code') {
      expect(model.body.path).toBe('src/code.ts')
      expect(model.body.code).toBe('const a = 1;')
    }
  })

  it('resolves error model for read tool with error', () => {
    const model = resolveToolViewModel({
      name: 'read',
      args: { path: 'missing.ts' },
      result: { isError: true, content: [{ type: 'text', text: 'File not found' }] },
      cwd,
      homedir,
    })
    expect(model.body?.kind).toBe('error')
    if (model.body?.kind === 'error') {
      expect(model.body.message).toBe('File not found')
    }
  })

  it('resolves shell model for bash commands', () => {
    const model = resolveToolViewModel({
      name: 'bash',
      args: { command: 'ls -la' },
      result: 'file1\nfile2',
      cwd,
      homedir,
    })
    expect(model.body?.kind).toBe('shell')
    if (model.body?.kind === 'shell') {
      expect(model.body.command).toBe('ls -la')
      expect(model.body.resultText).toBe('file1\nfile2')
    }
  })

  it('collapses failed edit/write attempts', () => {
    const model = resolveToolViewModel({
      name: 'edit',
      args: { path: 'src/app.ts' },
      result: { isError: true, content: 'Failed edit' },
      cwd,
      homedir,
    })
    expect(model.label).toBe('Edit attempted')
    expect(model.body).toBeNull()
  })

  it('resolves generic model for miscellaneous tools', () => {
    const model = resolveToolViewModel({
      name: 'weather',
      args: { city: 'Tokyo' },
      result: '20°C, Sunny',
      cwd,
      homedir,
    })
    expect(model.body?.kind).toBe('generic')
    if (model.body?.kind === 'generic') {
      expect(model.body.resultText).toBe('20°C, Sunny')
    }
  })

  it('shows a scheduled wakeup as its reason and the delay settled on', () => {
    const model = resolveToolViewModel({
      name: 'schedule_wakeup',
      args: { delaySeconds: 5, reason: 'watching CI' },
      result: {
        content: [{ type: 'text', text: 'Next iteration in 1m' }],
        details: { ms: 60_000 },
      },
    })
    expect(model).toMatchObject({ label: 'Schedule Wakeup', summary: 'watching CI', meta: 'in 1m' })
    expect(model.body).toBeNull()
  })

  it('shows a stopped wakeup as the loop ending', () => {
    const model = resolveToolViewModel({
      name: 'schedule_wakeup',
      args: { stop: true },
      result: { content: [{ type: 'text', text: 'The loop ended.' }], details: {} },
    })
    expect(model).toMatchObject({ meta: 'Loop ended', body: null })
  })

  it('shows a failed wakeup as an error', () => {
    const model = resolveToolViewModel({
      name: 'schedule_wakeup',
      args: {},
      live: {
        toolCallId: '1',
        toolName: 'schedule_wakeup',
        args: {},
        status: 'done',
        isError: true,
        result: 'No self-paced loop is running.',
      },
    })
    expect(model.body).toEqual({ kind: 'error', message: 'No self-paced loop is running.' })
  })
})
