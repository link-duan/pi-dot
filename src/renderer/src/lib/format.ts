import { displayPath } from './path'

export function asText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map((block) => {
        if (block && typeof block === 'object' && 'text' in block) {
          return String((block as { text: unknown }).text ?? '')
        }
        if (block && typeof block === 'object' && 'content' in block) {
          return asText((block as { content: unknown }).content)
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  if (typeof value === 'object' && 'content' in value) {
    return asText((value as { content: unknown }).content)
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function prettyJson(value: unknown): string {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2) ?? ''
  } catch {
    return String(value)
  }
}

const TOOL_LABELS: Record<string, string> = {
  bash: 'Bash',
  grep: 'Grep',
  edit: 'Edit',
  read: 'Read',
  write: 'Write',
  find: 'Find',
  ls: 'Ls',
}

export function toolLabel(name: string): string {
  return TOOL_LABELS[name.toLowerCase()] ?? name
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function pathField(
  record: Record<string, unknown>,
  cwd?: string | null,
  home?: string | null,
): string {
  const path = stringField(record, 'path', 'TargetFile', 'AbsolutePath')
  return path ? displayPath(path, cwd, home) : ''
}

function readRangeSuffix(record: Record<string, unknown>): string {
  const offset = numberField(record, 'offset')
  const limit = numberField(record, 'limit')
  if (offset == null && limit == null) return ''
  const start = offset ?? 1
  if (limit == null) return `:${start}`
  const end = start + limit - 1
  return end === start ? `:${start}` : `:${start}:${end}`
}

export function toolSummary(
  name: string,
  args: unknown,
  cwd?: string | null,
  home?: string | null,
): string {
  const record = asRecord(args)
  if (!record) return ''

  const lower = name.toLowerCase()
  if (
    lower === 'bash' ||
    lower.includes('command') ||
    lower.includes('exec') ||
    lower.includes('shell')
  ) {
    return stringField(record, 'command', 'CommandLine')
  }
  if (lower === 'grep' || lower === 'find') {
    return stringField(record, 'pattern', 'Query', 'query')
  }
  if (lower === 'read') {
    const path = pathField(record, cwd, home)
    return path ? `${path}${readRangeSuffix(record)}` : ''
  }
  if (lower === 'write' || lower === 'edit' || lower === 'ls') {
    return pathField(record, cwd, home)
  }

  const command = stringField(record, 'command', 'CommandLine')
  if (command) return command
  const path = pathField(record, cwd, home)
  if (path) return path
  return stringField(record, 'pattern', 'Query', 'query')
}

export interface DiffStats {
  added: number
  removed: number
}

function splitLines(text: string): string[] {
  if (!text) return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

function changedRange(oldLines: string[], newLines: string[]) {
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

export type DiffLineKind = 'add' | 'remove' | 'context'

export interface DiffLine {
  kind: DiffLineKind
  text: string
  oldLine?: number
  newLine?: number
  hunkStart?: boolean
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

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
      const fromPatch = statsFromPatch(patch)
      if (fromPatch) return fromPatch
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
    const record = asRecord(args)
    const content = typeof record?.content === 'string' ? record.content : ''
    const added = splitLines(content).length
    return added === 0 ? null : { added, removed: 0 }
  }
  return null
}

export function formatElapsed(ms: number): string {
  const clamped = Math.max(0, ms)
  const tenths = Math.round(clamped / 100)
  if (clamped < 1000 && tenths < 10) return `0.${tenths}s`
  const totalSeconds = Math.round(clamped / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  if (seconds) parts.push(`${seconds}s`)
  return parts.join(' ')
}

export function sessionTitle(item: { name?: string; firstMessage?: string }): string {
  const name = item.name?.trim()
  if (name) return name
  const first = item.firstMessage?.trim()
  if (first) return first.split('\n')[0] ?? first
  return 'Empty session'
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const sec = Math.max(0, Math.floor((now - then) / 1000))
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}h`
  return `${Math.floor(hour / 24)}d`
}

export const TIME_GROUP_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Last 7 days',
  older: 'Older',
} as const

export type TimeGroup = keyof typeof TIME_GROUP_LABELS

export function sessionTimeGroup(iso: string, now = Date.now()): TimeGroup {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'older'
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const start = startOfToday.getTime()
  if (then >= start) return 'today'
  if (then >= start - 86_400_000) return 'yesterday'
  if (then >= start - 7 * 86_400_000) return 'week'
  return 'older'
}

export function groupByTime<T extends { modified: string }>(
  items: T[],
  now = Date.now(),
): Array<{ group: TimeGroup; items: T[] }> {
  const buckets: Record<TimeGroup, T[]> = { today: [], yesterday: [], week: [], older: [] }
  for (const item of items) {
    buckets[sessionTimeGroup(item.modified, now)].push(item)
  }
  return (Object.keys(TIME_GROUP_LABELS) as TimeGroup[])
    .filter((group) => buckets[group].length > 0)
    .map((group) => ({ group, items: buckets[group] }))
}
