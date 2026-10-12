import type { CodemodeToolDetails } from '@earendil-works/pi-coding-agent'
import { asRecord } from '@/lib/format'
import { extractToolImages, type ToolImageItem } from './images'

export type CodemodeCall = CodemodeToolDetails['calls'][number]
export type CodemodeOutput =
  | { type: 'text'; text: string }
  | { type: 'image'; image: ToolImageItem }

// Header the SDK puts before script output; Pi TUI hides it as noise.
const SCRIPT_HEADER = /^Script (?:completed|failed)\nWall time ([\d.]+) seconds\nOutput:\n$/
// A failed script appends this marker and the error to its output.
const SCRIPT_ERROR = 'Script error:\n'
// Model-facing recap of nested call statuses after the error; the call rows already show it.
const CALL_RECAP =
  /\n\n(?:Tool calls made before the failure \(they are not undone\): [^\n]*|No tool calls were made\.)/

export interface CodemodeBodyModel {
  kind: 'codemode'
  code: string
  calls: CodemodeCall[]
  output: CodemodeOutput[]
  /** Script wall time in milliseconds, from the SDK header. */
  wallTimeMs?: number
  /** Script error, split from the output so it renders as one quiet line. */
  error?: string
}

export function resolveCodemodeBody(
  args: unknown,
  result: unknown,
  isError: boolean,
): CodemodeBodyModel {
  const payload = asRecord(args)
  const record = asRecord(result)
  const details = asRecord(record?.details)
  const calls = Array.isArray(details?.calls) ? (details.calls as CodemodeCall[]) : []
  const content = Array.isArray(record?.content) ? record.content : []
  let wallTimeMs: number | undefined
  let output: CodemodeOutput[] = []
  for (const [index, block] of content.entries()) {
    const item = asRecord(block)
    if (item?.type === 'text' && typeof item.text === 'string') {
      const header = index === 0 ? SCRIPT_HEADER.exec(item.text) : null
      if (header) {
        wallTimeMs = Number(header[1]) * 1000
        continue
      }
      // Keep leading indentation; only drop blank blocks and trailing whitespace.
      if (item.text.trim()) output.push({ type: 'text', text: item.text.trimEnd() })
    } else if (item?.type === 'image') {
      const image = extractToolImages({ content: [block] })[0]
      if (image) output.push({ type: 'image', image })
    }
  }

  let error: string | undefined
  if (isError) {
    // Truncation merges text blocks and moves images after them, so search every text block.
    let index = output.length - 1
    while (index >= 0 && !isErrorBlock(output[index])) index--
    const item = output[index]
    if (item?.type === 'text') {
      const at = item.text.lastIndexOf(SCRIPT_ERROR)
      const after = item.text.slice(at + SCRIPT_ERROR.length)
      const recap = CALL_RECAP.exec(after)
      error = (recap ? after.slice(0, recap.index) : after).trim()
      // Anything after the recap (truncation notice, notes) is still output.
      const tail = recap ? after.slice(recap.index + recap[0].length) : ''
      const rest = (item.text.slice(0, at).trimEnd() + tail).replace(/^\n+/, '').trimEnd()
      output = [
        ...output.slice(0, index),
        ...(rest ? [{ type: 'text' as const, text: rest }] : []),
        ...output.slice(index + 1),
      ]
    } else if (wallTimeMs === undefined) {
      // The codemode call itself was rejected (validation, permissions): its text is the error.
      error = output.flatMap((item) => (item.type === 'text' ? [item.text] : [])).join('\n')
      output = output.filter((item) => item.type !== 'text')
    }
  }

  return {
    kind: 'codemode',
    code: typeof payload?.code === 'string' ? payload.code : '',
    calls,
    output,
    ...(wallTimeMs === undefined ? {} : { wallTimeMs }),
    ...(error ? { error } : {}),
  }
}

function isErrorBlock(item: CodemodeOutput | undefined): boolean {
  return item?.type === 'text' && item.text.includes(SCRIPT_ERROR)
}

export function codemodeSummary(calls: CodemodeCall[]): string {
  if (!calls.length) return ''
  return `${calls.length} ${calls.length === 1 ? 'call' : 'calls'}`
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return ''
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}

export function codemodeCallMeta(call: CodemodeCall): string {
  const duration = formatDuration(call.durationMs)
  const cost = call.cost
    ? `$${call.cost >= 0.01 ? call.cost.toFixed(2) : call.cost.toPrecision(2)}`
    : ''
  const status = call.status === 'error' ? 'failed' : call.status === 'cancelled' ? 'cancelled' : ''
  return [duration, cost, status].filter(Boolean).join(' ')
}
