import { randomUUID } from 'node:crypto'
import type {
  ExtensionUIContext,
  ExtensionUIDialogOptions,
  ExtensionWidgetOptions,
} from '@earendil-works/pi-coding-agent'
import type { SessionEventBody, UiRequest, UiResponse, UiState } from '@shared/protocol'

type RequestBody = UiRequest extends infer R ? (R extends UiRequest ? Omit<R, 'id'> : never) : never

export interface ExtensionUi {
  context: ExtensionUIContext
  /** Settles the waiting dialog `id`; false when none is waiting. */
  respond(id: string, response: UiResponse): boolean
  snapshot(): { requests: UiRequest[]; state: UiState }
  /** Settles every waiting dialog as cancelled. */
  dispose(): void
}

/**
 * Pi Dot's `ctx.ui`: dialogs, statuses, text widgets and notices become native UI; anything
 * drawn with pi-tui components (custom, component widgets, header, footer, editor) is ignored,
 * as in pi's RPC mode.
 */
export function createExtensionUi(
  emit: (event: SessionEventBody) => void,
  theme: () => ExtensionUIContext['theme'],
): ExtensionUi {
  const waiting = new Map<string, { request: UiRequest; settle: (r: UiResponse) => void }>()
  const statuses: Record<string, string> = {}
  const widgets = new Map<string, UiState['widgets'][number]>()

  const state = (): UiState => ({ statuses: { ...statuses }, widgets: [...widgets.values()] })

  function dialog<T>(
    body: RequestBody,
    opts: ExtensionUIDialogOptions | undefined,
    fallback: T,
    parse: (response: UiResponse) => T,
  ): Promise<T> {
    if (opts?.signal?.aborted) return Promise.resolve(fallback)
    const id = randomUUID()
    const request = {
      ...body,
      id,
      ...(opts?.timeout ? { expiresAt: Date.now() + opts.timeout } : {}),
    } as UiRequest
    return new Promise<T>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const settle = (response: UiResponse) => {
        clearTimeout(timer)
        opts?.signal?.removeEventListener('abort', onAbort)
        waiting.delete(id)
        emit({ type: 'ui_dismiss', id })
        resolve(parse(response))
      }
      const onAbort = () => settle({ kind: 'cancel' })
      opts?.signal?.addEventListener('abort', onAbort, { once: true })
      if (opts?.timeout) timer = setTimeout(onAbort, opts.timeout)
      waiting.set(id, { request, settle })
      emit({ type: 'ui_request', request })
    })
  }

  const value = (response: UiResponse) => (response.kind === 'value' ? response.value : undefined)

  const context: ExtensionUIContext = {
    select: (title, options, opts) =>
      dialog({ method: 'select', title, options }, opts, undefined, value),
    confirm: (title, message, opts) =>
      dialog({ method: 'confirm', title, message }, opts, false, (response) =>
        response.kind === 'confirm' ? response.confirmed : false,
      ),
    input: (title, placeholder, opts) =>
      dialog({ method: 'input', title, placeholder }, opts, undefined, value),
    editor: (title, prefill) =>
      dialog({ method: 'editor', title, prefill }, undefined, undefined, value),
    notify(message, type) {
      emit({ type: 'ui_notify', message, level: type ?? 'info' })
    },
    setStatus(key, text) {
      if (text === undefined) delete statuses[key]
      else statuses[key] = text
      emit({ type: 'ui_state', state: state() })
    },
    setWidget(key: string, content: unknown, options?: ExtensionWidgetOptions) {
      // Component widgets need pi-tui; only text lines are shown.
      if (content !== undefined && !Array.isArray(content)) return
      if (content === undefined) widgets.delete(key)
      else
        widgets.set(key, {
          key,
          lines: content.map(String),
          placement: options?.placement ?? 'aboveEditor',
        })
      emit({ type: 'ui_state', state: state() })
    },
    setEditorText(text) {
      emit({ type: 'ui_editor_text', text })
    },
    pasteToEditor(text) {
      emit({ type: 'ui_editor_text', text })
    },
    getEditorText: () => '',
    onTerminalInput: () => () => {},
    setWorkingMessage() {},
    setWorkingVisible() {},
    setWorkingIndicator() {},
    setHiddenThinkingLabel() {},
    setFooter() {},
    setHeader() {},
    setTitle() {},
    custom: async () => undefined as never,
    addAutocompleteProvider() {},
    setEditorComponent() {},
    getEditorComponent: () => undefined,
    get theme() {
      return theme()
    },
    getAllThemes: () => [],
    getTheme: () => undefined,
    setTheme: () => ({ success: false, error: 'Themes are not supported in Pi Dot' }),
    getToolsExpanded: () => false,
    setToolsExpanded() {},
  }

  return {
    context,
    respond(id, response) {
      const entry = waiting.get(id)
      entry?.settle(response)
      return Boolean(entry)
    },
    snapshot: () => ({
      requests: [...waiting.values()].map((entry) => entry.request),
      state: state(),
    }),
    dispose() {
      for (const entry of waiting.values()) entry.settle({ kind: 'cancel' })
    },
  }
}
