export type FileRange = { start: number; end?: number }

export type FileRef = {
  path: string
  range?: FileRange
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i
const FILE_TOKEN = /@file:(?:"([^"]+)"(?::(\d+)(?:-(\d+))?)?|([^\s]+))/

function dropRange(path: string): boolean {
  return path.endsWith('/') || IMAGE_EXT.test(path)
}

export function peelRange(raw: string): FileRef {
  const match = raw.match(/^(.*):(\d+)(?:-(\d+))?$/)
  if (!match || match[1] === '') return { path: raw }
  const path = match[1]!
  if (dropRange(path)) return { path }
  const start = Number(match[2])
  const end = match[3] != null ? Number(match[3]) : undefined
  return { path, range: end == null ? { start } : { start, end } }
}

export function formatFileToken(ref: FileRef): string {
  const quoted = /[\s"]/.test(ref.path) ? `"${ref.path.replaceAll('"', '')}"` : ref.path
  let out = `@file:${quoted}`
  if (ref.range && !dropRange(ref.path)) {
    out += ref.range.end == null ? `:${ref.range.start}` : `:${ref.range.start}-${ref.range.end}`
  }
  return out
}

export function matchFileTokens(
  text: string,
): Array<{ index: number; length: number; ref: FileRef }> {
  const out: Array<{ index: number; length: number; ref: FileRef }> = []
  for (const match of text.matchAll(new RegExp(FILE_TOKEN.source, 'g'))) {
    const quoted = match[1]
    const unquoted = match[4]
    const ref = quoted != null ? quotedRange(quoted, match[2], match[3]) : peelRange(unquoted ?? '')
    if (!ref.path) continue
    out.push({ index: match.index ?? 0, length: match[0].length, ref })
  }
  return out
}

// Temp files written for pasted screenshots; their uuid names mean nothing to the user.
const CLIPBOARD_IMAGE = /(?:^|\/)pi-ui-clipboard-[\w-]+\.\w+$/

export function isClipboardImage(path: string): boolean {
  return CLIPBOARD_IMAGE.test(path)
}
const MAX_NAME = 28

export function fileChipLabel(path: string, range?: FileRange): string {
  const dir = path.endsWith('/')
  const trimmed = dir ? path.replace(/\/+$/, '') : path
  const base = trimmed.split('/').filter(Boolean).at(-1) ?? trimmed
  const short = isClipboardImage(base)
    ? 'Image'
    : base.length > MAX_NAME
      ? `${base.slice(0, 16)}…${base.slice(-10)}`
      : base
  const name = dir ? `${short}/` : short
  if (!range) return name
  if (range.end == null) return `${name}:${range.start}`
  return `${name}:${range.start}-${range.end}`
}

function quotedRange(path: string, startRaw?: string, endRaw?: string): FileRef {
  if (startRaw == null || dropRange(path)) return { path }
  const start = Number(startRaw)
  const end = endRaw != null ? Number(endRaw) : undefined
  return { path, range: end == null ? { start } : { start, end } }
}
