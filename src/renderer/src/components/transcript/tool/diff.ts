import { asRecord } from '@/lib/format'

export interface DiffStats {
  added: number
  removed: number
}

export type DiffLineKind = 'add' | 'remove' | 'context'

export interface DiffLine {
  kind: DiffLineKind
  text: string
  oldLine?: number
  newLine?: number
  hunkStart?: boolean
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

export function splitLines(text: string): string[] {
  if (!text) return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

export function changedRange(oldLines: string[], newLines: string[]) {
  let start = 0
  while (
    start < oldLines.length &&
    start < newLines.length &&
    oldLines[start] === newLines[start]
  ) {
    start++
  }
  let oldEnd = oldLines.length
  let newEnd = newLines.length
  while (oldEnd > start && newEnd > start && oldLines[oldEnd - 1] === newLines[newEnd - 1]) {
    oldEnd--
    newEnd--
  }
  return { start, oldEnd, newEnd }
}

function statsFromTexts(oldText: string, newText: string): DiffStats {
  const { start, oldEnd, newEnd } = changedRange(splitLines(oldText), splitLines(newText))
  return { added: newEnd - start, removed: oldEnd - start }
}

function statsFromPatch(patch: string): DiffStats | null {
  let added = 0
  let removed = 0
  for (const line of patch.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue
    if (line.startsWith('+')) added++
    else if (line.startsWith('-')) removed++
  }
  return added === 0 && removed === 0 ? null : { added, removed }
}

function resultPatch(result: unknown): string {
  const record = asRecord(result)
  const details = asRecord(record?.details)
  return typeof details?.patch === 'string' ? details.patch : ''
}

function parseEdits(record: Record<string, unknown>): Array<{ oldText: string; newText: string }> {
  let list: unknown = record.edits
  if (typeof list === 'string' && list.trim()) {
    try {
      list = JSON.parse(list)
    } catch {
      list = null
    }
  }
  if (Array.isArray(list)) {
    const edits: Array<{ oldText: string; newText: string }> = []
    for (const item of list) {
      const edit = asRecord(item)
      if (!edit) continue
      const oldText = typeof edit.oldText === 'string' ? edit.oldText : ''
      const newText = typeof edit.newText === 'string' ? edit.newText : ''
      if (oldText || newText) edits.push({ oldText, newText })
    }
    return edits
  }
  const oldText = typeof record.oldText === 'string' ? record.oldText : ''
  const newText = typeof record.newText === 'string' ? record.newText : ''
  return oldText || newText ? [{ oldText, newText }] : []
}

function pushDiffLine(lines: DiffLine[], line: DiffLine, hunkStart: boolean): void {
  if (hunkStart) line.hunkStart = true
  lines.push(line)
}

function linesFromTexts(oldText: string, newText: string): DiffLine[] {
  const oldLines = splitLines(oldText)
  const newLines = splitLines(newText)
  const { start, oldEnd, newEnd } = changedRange(oldLines, newLines)
  if (oldEnd === start && newEnd === start) return []
  const lines: DiffLine[] = []
  let oldLine = 1
  let newLine = 1
  for (let i = 0; i < start; i++) {
    lines.push({ kind: 'context', text: oldLines[i] ?? '', oldLine, newLine })
    oldLine++
    newLine++
  }
  for (let i = start; i < oldEnd; i++) {
    lines.push({ kind: 'remove', text: oldLines[i] ?? '', oldLine })
    oldLine++
  }
  for (let i = start; i < newEnd; i++) {
    lines.push({ kind: 'add', text: newLines[i] ?? '', newLine })
    newLine++
  }
  for (let i = oldEnd; i < oldLines.length; i++) {
    lines.push({ kind: 'context', text: oldLines[i] ?? '', oldLine, newLine })
    oldLine++
    newLine++
  }
  return lines
}

function linesFromPatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = []
  let oldLine = 1
  let newLine = 1
  let hunkStart = false
  for (const line of patch.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue
    const header = line.match(HUNK_HEADER)
    if (header) {
      oldLine = Number(header[1])
      newLine = Number(header[2])
      hunkStart = lines.length > 0
      continue
    }
    if (line.startsWith('\\')) continue
    if (line.startsWith('+')) {
      pushDiffLine(lines, { kind: 'add', text: line.slice(1), newLine }, hunkStart)
      newLine++
      hunkStart = false
    } else if (line.startsWith('-')) {
      pushDiffLine(lines, { kind: 'remove', text: line.slice(1), oldLine }, hunkStart)
      oldLine++
      hunkStart = false
    } else {
      pushDiffLine(
        lines,
        {
          kind: 'context',
          text: line.startsWith(' ') ? line.slice(1) : line,
          oldLine,
          newLine,
        },
        hunkStart,
      )
      oldLine++
      newLine++
      hunkStart = false
    }
  }
  return lines
}

function hasDiffEdits(lines: DiffLine[]): boolean {
  return lines.some((line) => line.kind === 'add' || line.kind === 'remove')
}

export function toolEditDiff(args: unknown, result?: unknown): DiffLine[] | null {
  const patch = resultPatch(result)
  if (patch) {
    const fromPatch = linesFromPatch(patch)
    if (hasDiffEdits(fromPatch)) return fromPatch
  }
  const record = asRecord(args)
  if (!record) return null
  const edits = parseEdits(record)
  if (edits.length === 0) return null
  const lines: DiffLine[] = []
  for (const edit of edits) {
    const hunk = linesFromTexts(edit.oldText, edit.newText)
    if (hunk.length === 0) continue
    if (lines.length > 0 && hunk[0]) hunk[0].hunkStart = true
    lines.push(...hunk)
  }
  return hasDiffEdits(lines) ? lines : null
}

function writeLines(args: unknown): string[] {
  const record = asRecord(args)
  if (!record || typeof record.content !== 'string') return []
  return splitLines(record.content)
}

export function toolWriteDiff(args: unknown): DiffLine[] | null {
  const lines = writeLines(args)
  if (lines.length === 0) return null
  return lines.map((text, i) => ({ kind: 'add', text, newLine: i + 1 }))
}

function hunkRange(count: number, start?: number): string | null {
  if (start == null) return null
  return count === 1 ? `${start}` : `${start},${count}`
}

export function formatDiffCopy(lines: DiffLine[]): string {
  const out: string[] = []
  let index = 0
  while (index < lines.length) {
    const start = index
    index++
    while (index < lines.length && !lines[index]?.hunkStart) index++
    const hunk = lines.slice(start, index)
    let oldCount = 0
    let newCount = 0
    let oldStart: number | undefined
    let newStart: number | undefined
    for (const line of hunk) {
      if (line.kind !== 'add') {
        oldCount++
        oldStart ??= line.oldLine
      }
      if (line.kind !== 'remove') {
        newCount++
        newStart ??= line.newLine
      }
    }
    const oldRange = hunkRange(oldCount, oldStart)
    const newRange = hunkRange(newCount, newStart)
    if (oldRange && newRange) out.push(`@@ -${oldRange} +${newRange} @@`)
    for (const line of hunk) {
      if (line.kind === 'add') out.push(`+${line.text}`)
      else if (line.kind === 'remove') out.push(`-${line.text}`)
      else out.push(` ${line.text}`)
    }
  }
  return out.join('\n')
}

export function toolDiffStats(name: string, args: unknown, result?: unknown): DiffStats | null {
  const lower = name.toLowerCase()
  if (lower === 'edit') {
    const patch = resultPatch(result)
    if (patch) {
      const stats = statsFromPatch(patch)
      if (stats) return stats
    }
    const record = asRecord(args)
    if (!record) return null
    const edits = parseEdits(record)
    if (edits.length === 0) return null
    let added = 0
    let removed = 0
    for (const edit of edits) {
      const stats = statsFromTexts(edit.oldText, edit.newText)
      added += stats.added
      removed += stats.removed
    }
    return added === 0 && removed === 0 ? null : { added, removed }
  }
  if (lower === 'write') {
    const lines = writeLines(args)
    return lines.length === 0 ? null : { added: lines.length, removed: 0 }
  }
  return null
}
