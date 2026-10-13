import { describe, expect, it, vi } from 'vitest'
import type { SessionEventBody } from '@shared/protocol'
import { createExtensionUi } from './extension-ui'

function setup() {
  const events: SessionEventBody[] = []
  const ui = createExtensionUi(
    (event) => events.push(event),
    () => ({}) as never,
  )
  const lastRequest = () => {
    const event = events.findLast((item) => item.type === 'ui_request')
    return event?.type === 'ui_request' ? event.request : undefined
  }
  return { ui, events, lastRequest }
}

describe('createExtensionUi', () => {
  it('waits for the answer to a dialog and dismisses it', async () => {
    const { ui, events, lastRequest } = setup()
    const picked = ui.context.select('Target?', ['staging', 'production'])
    const request = lastRequest()!
    expect(request).toMatchObject({
      method: 'select',
      title: 'Target?',
      options: ['staging', 'production'],
    })
    expect(ui.snapshot().requests).toEqual([request])
    expect(ui.respond('other', { kind: 'cancel' })).toBe(false)
    expect(ui.respond(request.id, { kind: 'value', value: 'production' })).toBe(true)
    await expect(picked).resolves.toBe('production')
    expect(events.at(-1)).toEqual({ type: 'ui_dismiss', id: request.id })
    expect(ui.snapshot().requests).toEqual([])
  })

  it('answers confirm and input with their own shapes', async () => {
    const { ui, lastRequest } = setup()
    const confirmed = ui.context.confirm('Delete?', 'Gone for good')
    ui.respond(lastRequest()!.id, { kind: 'confirm', confirmed: true })
    await expect(confirmed).resolves.toBe(true)
    const typed = ui.context.input('Name', 'e.g. demo')
    expect(lastRequest()).toMatchObject({ method: 'input', placeholder: 'e.g. demo' })
    ui.respond(lastRequest()!.id, { kind: 'cancel' })
    await expect(typed).resolves.toBeUndefined()
  })

  it('settles with the default on timeout, abort and dispose', async () => {
    vi.useFakeTimers()
    try {
      const { ui, lastRequest } = setup()
      const timed = ui.context.confirm('Sure?', '', { timeout: 1000 })
      expect(lastRequest()?.expiresAt).toBe(Date.now() + 1000)
      vi.advanceTimersByTime(1000)
      await expect(timed).resolves.toBe(false)

      const controller = new AbortController()
      const aborted = ui.context.select('Pick', ['a'], { signal: controller.signal })
      controller.abort()
      await expect(aborted).resolves.toBeUndefined()

      const pending = ui.context.editor('Notes', 'draft')
      ui.dispose()
      await expect(pending).resolves.toBeUndefined()
      expect(ui.snapshot().requests).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps statuses and text widgets, ignoring component widgets', () => {
    const { ui, events } = setup()
    ui.context.setStatus('lint', 'ok')
    ui.context.setWidget('todo', ['- [ ] ship'], { placement: 'belowEditor' })
    ui.context.setWidget('tui', (() => ({})) as never)
    expect(ui.snapshot().state).toEqual({
      statuses: { lint: 'ok' },
      widgets: [{ key: 'todo', lines: ['- [ ] ship'], placement: 'belowEditor' }],
    })
    ui.context.setStatus('lint', undefined)
    ui.context.setWidget('todo', undefined)
    expect(ui.snapshot().state).toEqual({ statuses: {}, widgets: [] })
    expect(events.filter((event) => event.type === 'ui_state')).toHaveLength(4)
  })

  it('passes notices and editor text through', () => {
    const { ui, events } = setup()
    ui.context.notify('Deployed', 'warning')
    ui.context.setEditorText('/deploy prod')
    expect(events).toEqual([
      { type: 'ui_notify', message: 'Deployed', level: 'warning' },
      { type: 'ui_editor_text', text: '/deploy prod' },
    ])
  })
})
