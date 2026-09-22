import { useEffect, useRef, useState } from 'react'
import * as monaco from 'monaco-editor'
import { json } from 'monaco-editor'
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import jsonWorker from 'monaco-editor/languages/features/json/json.worker.js?worker'
import { modelsJsonSchema } from '@shared/models-json-schema'

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new jsonWorker()
    return new editorWorker()
  },
}

const MODEL_URI = monaco.Uri.parse('pi://models.json')

let schemaReady = false

function ensureLanguage(): void {
  if (schemaReady) return
  json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    comments: 'ignore',
    trailingCommas: 'ignore',
    schemaValidation: 'warning',
    schemas: [
      {
        uri: 'pi://models.json',
        fileMatch: ['*'],
        schema: modelsJsonSchema,
      },
    ],
  })
  json.jsonDefaults.setModeConfiguration({
    documentFormattingEdits: true,
    documentRangeFormattingEdits: true,
    completionItems: true,
    hovers: true,
    documentSymbols: true,
    tokens: true,
    colors: true,
    foldingRanges: true,
    diagnostics: true,
    selectionRanges: true,
  })
  schemaReady = true
}

function cssColor(css: string): string {
  const probe = document.createElement('span')
  probe.style.backgroundColor = css
  probe.style.position = 'fixed'
  probe.style.width = '2px'
  probe.style.height = '2px'
  probe.style.left = '-9999px'
  document.body.append(probe)
  const computed = getComputedStyle(probe).backgroundColor
  probe.remove()
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return '#888888'
  ctx.fillStyle = computed
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  const rgb = [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
  if (a === 0) return '#888888'
  if (a < 255) return `#${rgb}${a.toString(16).padStart(2, '0')}`
  return `#${rgb}`
}

function fromVar(name: string, mix = 100): string {
  const css = mix >= 100 ? `var(${name})` : `color-mix(in oklch, var(${name}) ${mix}%, transparent)`
  return cssColor(css)
}

function ruleColor(hex: string): string {
  return hex.replace('#', '').slice(0, 6)
}

function definePiThemes(): 'pi-light' | 'pi-dark' {
  const dark = document.documentElement.classList.contains('dark')
  const theme = dark ? 'pi-dark' : 'pi-light'
  const fg = fromVar('--foreground')
  const muted = fromVar('--muted-foreground')
  const bg = fromVar('--background')
  const popover = fromVar('--popover')
  const popoverFg = fromVar('--popover-foreground')
  const border = fromVar('--border')
  const accent = fromVar('--accent')
  const key = fromVar('--ansi-4')
  const string = fromVar('--ansi-2')
  const number = fromVar('--ansi-3')
  const keyword = fromVar('--ansi-5')
  const delim = ruleColor(muted)
  monaco.editor.defineTheme(theme, {
    base: dark ? 'vs-dark' : 'vs',
    inherit: false,
    rules: [
      { token: '', foreground: ruleColor(fg) },
      { token: 'comment', foreground: delim, fontStyle: 'italic' },
      { token: 'string.key.json', foreground: ruleColor(key) },
      { token: 'string.value.json', foreground: ruleColor(string) },
      { token: 'string', foreground: ruleColor(string) },
      { token: 'number', foreground: ruleColor(number) },
      { token: 'keyword', foreground: ruleColor(keyword) },
      { token: 'delimiter', foreground: delim },
      { token: 'delimiter.bracket', foreground: delim },
      { token: 'delimiter.square', foreground: delim },
      { token: 'delimiter.colon', foreground: delim },
      { token: 'delimiter.comma', foreground: delim },
      { token: 'delimiter.bracket.json', foreground: delim },
      { token: 'delimiter.array.json', foreground: delim },
      { token: 'delimiter.colon.json', foreground: delim },
      { token: 'delimiter.comma.json', foreground: delim },
    ],
    colors: {
      'editor.background': bg,
      'editor.foreground': fg,
      'editorLineNumber.foreground': muted,
      'editorLineNumber.activeForeground': fg,
      'editor.selectionBackground': fromVar('--foreground', 22),
      'editor.inactiveSelectionBackground': fromVar('--foreground', 12),
      'editor.lineHighlightBackground': fromVar('--muted', 55),
      'editorCursor.foreground': fg,
      'editorWidget.background': popover,
      'editorWidget.foreground': popoverFg,
      'editorWidget.border': border,
      'editorHoverWidget.background': popover,
      'editorHoverWidget.foreground': popoverFg,
      'editorHoverWidget.border': border,
      'editorSuggestWidget.background': popover,
      'editorSuggestWidget.foreground': popoverFg,
      'editorSuggestWidget.border': border,
      'editorSuggestWidget.selectedBackground': accent,
      'editorGutter.background': bg,
      'editorIndentGuide.background1': border,
      'scrollbarSlider.background': fromVar('--muted-foreground', 35),
      'scrollbarSlider.hoverBackground': fromVar('--muted-foreground', 55),
      focusBorder: '#00000000',
    },
  })
  monaco.editor.setTheme(theme)
  return theme
}

export function ModelsJsonEditor({
  value,
  offset,
  onChange,
  onBlur,
}: {
  value: string
  offset?: number
  onChange: (value: string) => void
  onBlur: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const onChangeRef = useRef(onChange)
  const onBlurRef = useRef(onBlur)
  const [initial] = useState(value)

  useEffect(() => {
    onChangeRef.current = onChange
    onBlurRef.current = onBlur
  }, [onChange, onBlur])

  useEffect(() => {
    const node = rootRef.current
    if (!node) return
    ensureLanguage()
    definePiThemes()
    const existing = monaco.editor.getModel(MODEL_URI)
    const model = existing ?? monaco.editor.createModel(initial, 'json', MODEL_URI)
    if (existing && existing.getValue() !== initial) existing.setValue(initial)
    const editor = monaco.editor.create(node, {
      model,
      fontSize: 12,
      fontFamily: 'var(--font-mono)',
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      tabSize: 2,
      padding: { top: 8, bottom: 8 },
      lineNumbers: 'on',
      lineNumbersMinChars: 4,
      lineDecorationsWidth: 10,
      glyphMargin: false,
      renderLineHighlight: 'all',
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
      hover: { enabled: 'on', delay: 250, sticky: true },
      quickSuggestions: { strings: 'on', other: 'on', comments: 'off' },
      suggestOnTriggerCharacters: true,
    })
    editorRef.current = editor
    const change = editor.onDidChangeModelContent(() => onChangeRef.current(editor.getValue()))
    const blur = editor.onDidBlurEditorWidget(() => onBlurRef.current())
    const themeSync = () => definePiThemes()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', themeSync)
    const observer = new MutationObserver(themeSync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => {
      change.dispose()
      blur.dispose()
      media.removeEventListener('change', themeSync)
      observer.disconnect()
      editor.dispose()
      editorRef.current = null
    }
  }, [initial])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || editor.getValue() === value) return
    editor.setValue(value)
  }, [value])

  useEffect(() => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model || offset == null || offset < 0) return
    const position = model.getPositionAt(offset)
    editor.revealPositionInCenter(position)
    editor.setPosition(position)
  }, [offset])

  return (
    <div ref={rootRef} className="app-no-drag size-full min-h-0 overflow-hidden bg-background" />
  )
}
