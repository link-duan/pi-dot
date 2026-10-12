import type { ToolLiveState } from '@/chat/state'
import { asRecord, asText, prettyJson, toolReadPreview, toolSummary } from '@/lib/format'
import { ASK_USER_TOOL, askQuestions, type AskQuestion, type AskReply } from '@shared/protocol'
import type { LucideIcon } from 'lucide-react'
import {
  codemodeSummary,
  formatDuration,
  resolveCodemodeBody,
  type CodemodeBodyModel,
} from './codemode'
import { toolDiffStats, toolEditDiff, toolWriteDiff, type DiffLine, type DiffStats } from './diff'
import { extractToolImages, resolveToolImageText, type ToolImageItem } from './images'
import {
  getToolIcon,
  isCollapsedToolAttempt,
  isEditTool,
  isReadTool,
  isShellTool,
  isToolError,
  isWriteTool,
  toolLabel,
} from './kind'

export type ToolBodyModel =
  | CodemodeBodyModel
  | { kind: 'diff'; path: string; lines: DiffLine[]; stats: DiffStats }
  | {
      kind: 'images'
      images: ToolImageItem[]
      argsText?: string
      notice?: string
      description?: string
    }
  | { kind: 'code'; path: string; code: string; startLine: number; notice?: string }
  | { kind: 'shell'; command: string; resultText: string; error?: boolean }
  | { kind: 'error'; message: string }
  | { kind: 'generic'; argsText?: string; resultText?: string; error?: boolean }
  | { kind: 'question'; questions: AskQuestion[]; reply: Exclude<AskReply, { kind: 'skipped' }> }

export interface ToolViewModel {
  icon: LucideIcon
  label: string
  summary: string
  /** Quiet trailing detail, e.g. codemode wall time. */
  meta: string
  stats: DiffStats | null
  running: boolean
  hasError: boolean
  hideMetaWhenOpen: boolean
  body: ToolBodyModel | null
}

export interface ResolveToolParams {
  name: string
  args: unknown
  live?: ToolLiveState
  result?: unknown
  pending?: boolean
  cwd?: string | null
  homedir?: string | null
}

function isArgsCoveredBySummary(args: unknown, summary: string): boolean {
  if (!summary || !args || typeof args !== 'object' || Array.isArray(args)) return false
  const keys = Object.keys(args)
  if (keys.length !== 1) return false
  const val = String((args as Record<string, unknown>)[keys[0]!] ?? '')
  return val.length > 0 && summary.includes(val)
}

export function resolveToolViewModel(params: ResolveToolParams): ToolViewModel {
  const { name, args, live, result, pending, cwd, homedir } = params
  const running = live?.status === 'running' || Boolean(pending && live?.status !== 'done')
  const payload = live?.args ?? args
  const resolved = live?.result ?? live?.partialResult ?? result
  const rawError = Boolean(live?.isError) || isToolError(resolved)
  const collapsedAttempt = isCollapsedToolAttempt(name, rawError)
  let summary = collapsedAttempt ? '' : toolSummary(name, payload, cwd, homedir)

  let body: ToolBodyModel | null = null
  let meta = ''
  const codemode = name.toLowerCase() === 'codemode'

  if (codemode) {
    const codemodeBody = resolveCodemodeBody(payload, resolved, rawError)
    summary = codemodeSummary(codemodeBody.calls)
    meta = formatDuration(codemodeBody.wallTimeMs)
    // Arguments may still be empty while streaming; an empty body would leave an empty panel.
    const { code, calls, output, error } = codemodeBody
    if (code || calls.length || output.length || error) body = codemodeBody
  } else if (name === ASK_USER_TOOL) {
    const questions = askQuestions(payload)
    summary = questions[0]?.question ?? ''
    const reply = (asRecord(resolved)?.details as { reply?: AskReply } | undefined)?.reply
    if (reply?.kind === 'skipped') {
      meta = 'Skipped'
    } else if (reply) {
      body = { kind: 'question', questions, reply }
      if (reply.kind === 'message') meta = 'Replied'
      // The summary already shows a lone question.
      else if (questions.length > 1) meta = `${questions.length} questions`
    } else if (running) {
      meta = 'Waiting for you'
    } else if (rawError) {
      body = { kind: 'error', message: asText(resolved) }
    }
  } else if (!collapsedAttempt) {
    const fileDiff = isEditTool(name)
      ? toolEditDiff(payload, resolved)
      : isWriteTool(name)
        ? toolWriteDiff(payload)
        : null

    if (fileDiff) {
      const stats = toolDiffStats(name, payload, resolved) ?? { added: 0, removed: 0 }
      body = { kind: 'diff', path: summary, lines: fileDiff, stats }
    } else {
      const toolImages = extractToolImages(resolved, payload, cwd, homedir)
      if (toolImages.length > 0) {
        const { notice, description } = resolveToolImageText(name, resolved)
        const isSummaryRedundant = isArgsCoveredBySummary(payload, summary)
        const rawArgs = isShellTool(name) ? '' : prettyJson(payload)
        const argsText =
          rawArgs &&
          rawArgs !== '{}' &&
          rawArgs !== 'null' &&
          !isReadTool(name) &&
          !isSummaryRedundant
            ? rawArgs
            : undefined
        body = {
          kind: 'images',
          images: toolImages.map((image) => ({
            ...image,
            title: image.path ? undefined : summary || toolLabel(name),
          })),
          argsText,
          notice,
          description,
        }
      } else {
        const readPreview =
          isReadTool(name) && !rawError ? toolReadPreview(payload, resolved, cwd, homedir) : null
        if (readPreview) {
          body = readPreview
        } else if (isReadTool(name) && rawError) {
          const resultText = asText(resolved)
          if (resultText) {
            body = { kind: 'error', message: resultText }
          }
        } else if (isShellTool(name)) {
          const command = toolSummary(name, payload)
          body = { kind: 'shell', command, resultText: asText(resolved), error: rawError }
        } else if (!isWriteTool(name)) {
          const rawArgs = prettyJson(payload)
          const argsText = rawArgs && rawArgs !== '{}' && rawArgs !== 'null' ? rawArgs : ''
          const resultText = asText(resolved)
          if (argsText || resultText) {
            body = { kind: 'generic', argsText, resultText, error: rawError }
          }
        }
      }
    }
  }

  const hasImages = body?.kind === 'images'
  const icon = getToolIcon(name, summary, hasImages)
  const label = collapsedAttempt ? `${toolLabel(name)} attempted` : toolLabel(name)
  const stats = collapsedAttempt ? null : toolDiffStats(name, payload, resolved)
  // Codemode surfaces failures on its nested calls and output, not on the card itself.
  const hasError =
    rawError && !collapsedAttempt && !isShellTool(name) && !isReadTool(name) && !codemode
  const hideMetaWhenOpen = Boolean(
    body && (body.kind === 'diff' || body.kind === 'code' || body.kind === 'images'),
  )

  return {
    icon,
    label,
    summary,
    meta,
    stats,
    running: running && !collapsedAttempt,
    hasError,
    hideMetaWhenOpen,
    body,
  }
}
