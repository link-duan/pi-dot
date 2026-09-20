import type { CSSProperties } from 'react'

export type AnsiColor =
  | { kind: 'palette'; index: number }
  | { kind: 'rgb'; r: number; g: number; b: number }

export type AnsiStyle = {
  fg?: AnsiColor
  bg?: AnsiColor
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  inverse?: boolean
  hidden?: boolean
}

export type AnsiSpan = {
  text: string
  style: AnsiStyle
}

type Cell = { ch: string; style: AnsiStyle }

const EMPTY: AnsiStyle = {}
const cssCache = new WeakMap<AnsiStyle, CSSProperties>()

export function parseAnsi(input: string): AnsiSpan[] {
  input = input.replace(/\r\n/g, '\n')
  if (!hasControl(input)) return input ? [{ text: input, style: EMPTY }] : []

  const lines: Cell[][] = [[]]
  let line = lines[0]!
  let cursor = 0
  let style: AnsiStyle = EMPTY
  let i = 0

  const write = (ch: string) => {
    while (line.length < cursor) line.push({ ch: ' ', style: EMPTY })
    const cell = { ch, style }
    if (cursor < line.length) line[cursor] = cell
    else line.push(cell)
    cursor++
  }

  while (i < input.length) {
    const ch = input[i]!
    if (ch === '\n') {
      line = []
      lines.push(line)
      cursor = 0
      i++
      continue
    }
    if (ch === '\r') {
      cursor = 0
      i++
      continue
    }
    if (ch === '\b') {
      cursor = Math.max(0, cursor - 1)
      i++
      continue
    }
    if (ch === '\t') {
      const next = (Math.floor(cursor / 8) + 1) * 8
      while (cursor < next) write(' ')
      i++
      continue
    }
    if (ch === '\x1b' || ch === '\x9b') {
      const next = readEscape(input, i)
      if (next.sgr) style = applySgr(style, next.sgr)
      if (next.erase != null) {
        if (next.erase === 0) line.splice(cursor)
        else if (next.erase === 1) {
          for (let c = 0; c < cursor && c < line.length; c++) line[c] = { ch: ' ', style: EMPTY }
        } else {
          line.length = 0
        }
      }
      i = next.end
      continue
    }
    write(ch)
    i++
  }

  return cellsToSpans(lines)
}

export function ansiStyleToCss(style: AnsiStyle): CSSProperties {
  const cached = cssCache.get(style)
  if (cached) return cached
  const fg = style.inverse ? style.bg : style.fg
  const bg = style.inverse ? style.fg : style.bg
  const css: CSSProperties = {}
  const fgCss = colorCss(fg)
  const bgCss = colorCss(bg)
  if (fgCss) css.color = fgCss
  else if (style.inverse) css.color = 'var(--background)'
  if (bgCss) css.backgroundColor = bgCss
  else if (style.inverse) css.backgroundColor = 'var(--foreground)'
  if (style.bold) css.fontWeight = 600
  if (style.dim) css.opacity = 0.65
  if (style.italic) css.fontStyle = 'italic'
  const decorations: string[] = []
  if (style.underline) decorations.push('underline')
  if (style.strikethrough) decorations.push('line-through')
  if (decorations.length) css.textDecoration = decorations.join(' ')
  if (style.hidden) css.opacity = 0
  cssCache.set(style, css)
  return css
}

function cellsToSpans(lines: Cell[][]): AnsiSpan[] {
  const spans: AnsiSpan[] = []
  let buf: string[] = []
  let style = EMPTY
  const flush = () => {
    if (buf.length === 0) return
    const text = buf.join('')
    const last = spans.at(-1)
    if (last && last.style === style) last.text += text
    else spans.push({ text, style })
    buf = []
  }
  const emit = (text: string, next: AnsiStyle) => {
    if (next !== style) {
      flush()
      style = next
    }
    buf.push(text)
  }
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) emit('\n', EMPTY)
    for (const cell of lines[i]!) emit(cell.ch, cell.style)
  }
  flush()
  return spans
}

function colorCss(color: AnsiColor | undefined): string | undefined {
  if (!color) return
  if (color.kind === 'palette') return `var(--ansi-${color.index})`
  return `rgb(${color.r} ${color.g} ${color.b})`
}

function readEscape(
  input: string,
  start: number,
): { end: number; sgr?: number[][]; erase?: number } {
  const intro = input[start]
  let i = start + 1
  if (intro === '\x1b') {
    const next = input[i]
    if (next == null) return { end: i }
    if (next === '[') {
      i++
      return readCsi(input, i)
    }
    if (next === ']') {
      i++
      while (i < input.length) {
        if (input[i] === '\x07') return { end: i + 1 }
        if (input[i] === '\x1b' && input[i + 1] === '\\') return { end: i + 2 }
        i++
      }
      return { end: i }
    }
    return { end: i + 1 }
  }
  return readCsi(input, i)
}

function readCsi(input: string, start: number): { end: number; sgr?: number[][]; erase?: number } {
  let i = start
  while (i < input.length) {
    const code = input.charCodeAt(i)
    if (code >= 0x40 && code <= 0x7e) {
      const body = input.slice(start, i)
      const end = i + 1
      const final = input[i]
      if (final === 'm') return { end, sgr: parseParams(body) }
      if (final === 'K') {
        const params = parseParams(body)
        return { end, erase: params[0]?.[0] ?? 0 }
      }
      return { end }
    }
    i++
  }
  return { end: i }
}

function parseParams(body: string): number[][] {
  if (!body) return [[0]]
  return body.split(';').map((part) => {
    if (!part) return [0]
    return part.split(':').map((bit) => {
      const n = Number(bit)
      return Number.isFinite(n) ? n : 0
    })
  })
}

function applySgr(current: AnsiStyle, groups: number[][]): AnsiStyle {
  let style: AnsiStyle = current === EMPTY ? {} : { ...current }
  let i = 0
  while (i < groups.length) {
    const group = groups[i]!
    const code = group[0] ?? 0
    i++
    if (code === 0 && group.length === 1) {
      style = EMPTY
      continue
    }
    if (style === EMPTY) style = {}
    if (code === 1) style.bold = true
    else if (code === 2) style.dim = true
    else if (code === 3) style.italic = true
    else if (code === 4) style.underline = true
    else if (code === 7) style.inverse = true
    else if (code === 8) style.hidden = true
    else if (code === 9) style.strikethrough = true
    else if (code === 21 || code === 22) {
      delete style.bold
      delete style.dim
    } else if (code === 23) delete style.italic
    else if (code === 24) delete style.underline
    else if (code === 27) delete style.inverse
    else if (code === 28) delete style.hidden
    else if (code === 29) delete style.strikethrough
    else if (code >= 30 && code <= 37) style.fg = { kind: 'palette', index: code - 30 }
    else if (code === 39) delete style.fg
    else if (code >= 40 && code <= 47) style.bg = { kind: 'palette', index: code - 40 }
    else if (code === 49) delete style.bg
    else if (code >= 90 && code <= 97) style.fg = { kind: 'palette', index: code - 90 + 8 }
    else if (code >= 100 && code <= 107) style.bg = { kind: 'palette', index: code - 100 + 8 }
    else if (code === 38 || code === 48) {
      let value: AnsiColor | undefined
      if (group.length > 1) {
        value = colorFromParts(group.slice(1))
      } else {
        const consumed = readColorGroups(groups, i)
        value = consumed.value
        i = consumed.next
      }
      if (value) {
        if (code === 38) style.fg = value
        else style.bg = value
      }
    }
  }
  return style
}

function readColorGroups(groups: number[][], i: number): { value?: AnsiColor; next: number } {
  const mode = groups[i]?.[0]
  if (mode === 5 && groups[i + 1] != null) {
    return { value: indexColor(groups[i + 1]![0]!), next: i + 2 }
  }
  if (mode === 2 && groups[i + 3] != null) {
    return {
      value: rgbColor(groups[i + 1]![0]!, groups[i + 2]![0]!, groups[i + 3]![0]!),
      next: i + 4,
    }
  }
  return { next: i + 1 }
}

function colorFromParts(parts: number[]): AnsiColor | undefined {
  const mode = parts[0]
  if (mode === 5 && parts[1] != null) return indexColor(parts[1])
  if (mode === 2 && parts.length >= 5) return rgbColor(parts[2]!, parts[3]!, parts[4]!)
  if (mode === 2 && parts.length >= 4) return rgbColor(parts[1]!, parts[2]!, parts[3]!)
}

function rgbColor(r: number, g: number, b: number): AnsiColor {
  return { kind: 'rgb', r: clampByte(r), g: clampByte(g), b: clampByte(b) }
}

function indexColor(index: number): AnsiColor {
  const n = Math.max(0, Math.min(255, index))
  if (n < 16) return { kind: 'palette', index: n }
  if (n >= 232) {
    const v = 8 + (n - 232) * 10
    return { kind: 'rgb', r: v, g: v, b: v }
  }
  const x = n - 16
  const r = Math.floor(x / 36)
  const g = Math.floor((x % 36) / 6)
  const b = x % 6
  const step = (c: number) => (c === 0 ? 0 : 55 + c * 40)
  return { kind: 'rgb', r: step(r), g: step(g), b: step(b) }
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, n))
}

function hasControl(input: string): boolean {
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)
    if (code === 0x1b || code === 0x9b || code === 0x0d || code === 0x08) return true
  }
  return false
}
