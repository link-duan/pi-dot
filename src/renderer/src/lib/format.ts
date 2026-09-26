import { formatFileToken } from './file-token'
import { displayPath, isImageFile } from './path'
import { parseUserSegments, type UserSegment } from './user-message'

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
  } catch (error) {
    console.debug('Failed to format value as text', error)
    return String(value)
  }
}

export function prettyJson(value: unknown): string {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2) ?? ''
  } catch (error) {
    console.debug('Failed to format value as JSON', error)
    return String(value)
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function stringField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

export function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

export function pathField(
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
  return stringField(
    record,
    'pattern',
    'Query',
    'query',
    'nodeId',
    'node_id',
    'url',
    'prompt',
    'fileKey',
    'file_key',
  )
}

export interface ReadCodePreview {
  kind: 'code'
  path: string
  code: string
  startLine: number
  notice?: string
}

export type ReadPreview = ReadCodePreview

const READ_NOTICE = /\n\n\[((?:Showing lines |\d+ more lines in file)[^\]]*)\]\s*$/
const READ_LINE_EXCEEDS = /^\[Line \d+ is .+, exceeds /

function splitReadNotice(text: string): { code: string; notice?: string } {
  const match = text.match(READ_NOTICE)
  if (!match || match.index == null) return { code: text }
  return { code: text.slice(0, match.index), notice: `[${match[1]}]` }
}

export function toolReadPreview(
  args: unknown,
  result: unknown,
  cwd?: string | null,
  home?: string | null,
): ReadCodePreview | null {
  if (result == null) return null
  const record = asRecord(args)
  if (!record) return null
  const path = pathField(record, cwd, home)
  if (!path || isImageFile(path)) return null
  const text = asText(result)
  if (READ_LINE_EXCEEDS.test(text)) return null
  const startLine = numberField(record, 'offset') ?? 1
  return { kind: 'code', path, startLine, ...splitReadNotice(text) }
}

export function formatTokenCount(count: number): string {
  const abs = Math.abs(count)
  if (abs < 1000) return String(count)
  const scaled = abs < 1_000_000 ? count / 1000 : count / 1_000_000
  const rounded = Math.round(scaled * 10) / 10
  const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${display}${abs < 1_000_000 ? 'K' : 'M'}`
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

export function sessionTitleSegments(item: {
  name?: string
  firstMessage?: string
}): UserSegment[] {
  const name = item.name?.trim()
  if (name) return [{ type: 'text', text: name }]
  const first = item.firstMessage?.trim()
  if (!first) return [{ type: 'text', text: 'Empty session' }]
  const segments = firstLineSegments(parseUserSegments(first))
  return segments.length > 0 ? segments : [{ type: 'text', text: 'Empty session' }]
}

export function sessionTitle(item: { name?: string; firstMessage?: string }): string {
  let out = ''
  for (const segment of sessionTitleSegments(item)) {
    const piece =
      segment.type === 'skill'
        ? `/skill:${segment.name}`
        : segment.type === 'file'
          ? formatFileToken(segment)
          : segment.text
    if (!piece) continue
    if (out && !/\s$/.test(out) && !/^\s/.test(piece)) out += ' '
    out += piece
  }
  return out.trim() || 'Empty session'
}

function firstLineSegments(segments: UserSegment[]): UserSegment[] {
  const out: UserSegment[] = []
  for (const segment of segments) {
    if (segment.type !== 'text') {
      out.push(segment)
      continue
    }
    const newline = segment.text.indexOf('\n')
    if (newline === -1) {
      if (segment.text) out.push(segment)
      continue
    }
    const line = segment.text.slice(0, newline)
    if (line) out.push({ type: 'text', text: line })
    break
  }
  return out
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function formatMessageTime(timestamp: number, now = Date.now()): string {
  if (!Number.isFinite(timestamp)) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  const today = new Date(now)
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return time
  }
  const monthDay = `${MONTHS[date.getMonth()]} ${date.getDate()}`
  if (date.getFullYear() === today.getFullYear()) return `${monthDay}, ${time}`
  return `${monthDay}, ${date.getFullYear()}, ${time}`
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
