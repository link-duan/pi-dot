export type CodeCitation = {
  start: number
  end: number
  path: string
}

const FENCE_INFO = /^(\d+):(\d+):(.+)$/

const EXT_LANG: Record<string, string> = {
  cjs: 'js',
  cts: 'ts',
  htm: 'html',
  mjs: 'js',
  mts: 'ts',
  yml: 'yaml',
}

export function parseCodeCitation(info: string): CodeCitation | null {
  const match = info.trim().match(FENCE_INFO)
  if (!match) return null
  const start = Number(match[1])
  const end = Number(match[2])
  const path = match[3]
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || !path) {
    return null
  }
  return { start, end, path }
}

export function languageFromPath(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? path
  if (/^dockerfile$/i.test(base)) return 'dockerfile'
  if (/^makefile$/i.test(base)) return 'makefile'
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return 'text'
  const ext = base.slice(dot + 1).toLowerCase()
  return EXT_LANG[ext] ?? ext
}

export function citationLabel({ path, start, end }: CodeCitation): string {
  return start === end ? `${path}:${start}` : `${path}:${start}-${end}`
}
