import { useEffect, useRef, type RefObject } from 'react'
import type { ToolLiveState } from '@/chat/state'
import {
  FilePenLine,
  FilePlus,
  FileText,
  Folder,
  FolderSearch,
  Search,
  Terminal,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { citationLabel, languageFromPath } from '@/lib/code-citation'
import {
  asText,
  formatDiffCopy,
  isCollapsedToolAttempt,
  prettyJson,
  toolDiffStats,
  toolEditDiff,
  toolLabel,
  toolReadPreview,
  toolSummary,
  toolWriteDiff,
  type DiffLine,
  type DiffStats,
  type ReadPreview,
} from '@/lib/format'
import { tokenizeShell, type ShellTokenKind } from '@/lib/shell-highlight'
import { cn } from '@/lib/utils'
import { useSession } from '@/session/store'
import { ActivityRow } from './ActivityRow'
import { FileCard, HighlightedCode, HighlightedDiff } from './FileCard'

const TOKEN_CLASS: Record<ShellTokenKind, string> = {
  command: 'text-amber-600 dark:text-amber-400',
  string: 'text-emerald-600 dark:text-emerald-400',
  flag: 'text-muted-foreground',
  operator: 'text-muted-foreground',
  comment: 'text-muted-foreground',
  text: 'text-foreground',
}

function isToolError(result: unknown): boolean {
  return Boolean(result && typeof result === 'object' && 'isError' in result && result.isError)
}

function isEditTool(name: string): boolean {
  return name.toLowerCase() === 'edit'
}

function isReadTool(name: string): boolean {
  return name.toLowerCase() === 'read'
}

function isWriteTool(name: string): boolean {
  return name.toLowerCase() === 'write'
}

function isShellTool(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower === 'bash' ||
    lower.includes('command') ||
    lower.includes('exec') ||
    lower.includes('shell')
  )
}

function getToolIcon(name: string): LucideIcon {
  const lower = name.toLowerCase()
  if (isShellTool(name)) return Terminal
  if (lower === 'grep') return Search
  if (lower === 'find') return FolderSearch
  if (lower === 'edit') return FilePenLine
  if (lower === 'read') return FileText
  if (lower === 'write') return FilePlus
  if (lower === 'ls') return Folder
  if (
    lower.includes('file') ||
    lower.includes('write') ||
    lower.includes('read') ||
    lower.includes('edit')
  ) {
    return FileText
  }
  if (lower.includes('search') || lower.includes('find') || lower.includes('grep')) {
    return Search
  }
  return Wrench
}

function toolView(
  name: string,
  args: unknown,
  live?: ToolLiveState,
  result?: unknown,
  pending?: boolean,
) {
  const running = live?.status === 'running' || Boolean(pending && live?.status !== 'done')
  const payload = live?.args ?? args
  const resultText = asText(live?.result ?? live?.partialResult ?? result)
  const error = Boolean(live?.isError) || isToolError(result)
  const shell = isShellTool(name)
  const command = shell ? toolSummary(name, payload) : ''
  const rawArgs = shell ? '' : prettyJson(payload)
  const argsText = rawArgs && rawArgs !== '{}' && rawArgs !== 'null' ? rawArgs : ''
  return {
    running,
    payload,
    resultText,
    error,
    shell,
    command,
    argsText,
    hasDetails: Boolean(command || argsText || resultText),
    stats: toolDiffStats(name, payload, live?.result ?? result),
  }
}

export function ToolCard({
  name,
  args,
  live,
  result,
  pending,
}: {
  name: string
  args: unknown
  live?: ToolLiveState
  result?: unknown
  pending?: boolean
}) {
  const cwd = useSession((state) => state.cwd)
  const resultRef = useRef<HTMLPreElement>(null)
  const view = toolView(name, args, live, result, pending)
  const collapsedAttempt = isCollapsedToolAttempt(name, view.error)
  const resolved = live?.result ?? result
  const fileDiff = collapsedAttempt
    ? null
    : isEditTool(name)
      ? toolEditDiff(view.payload, resolved)
      : isWriteTool(name)
        ? toolWriteDiff(view.payload)
        : null
  const readPreview =
    isReadTool(name) && !view.error
      ? toolReadPreview(view.payload, resolved, cwd, window.pi.homedir)
      : null
  const summary = collapsedAttempt ? '' : toolSummary(name, view.payload, cwd, window.pi.homedir)

  useEffect(() => {
    if (!view.running) return
    const node = resultRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [view.running, view.resultText])

  let details = null
  if (!collapsedAttempt) {
    if (fileDiff) details = <EditDiff path={summary} stats={view.stats} lines={fileDiff} />
    else if (readPreview) details = <ReadFile preview={readPreview} />
    else if (view.hasDetails && !isWriteTool(name)) {
      details = (
        <ToolDetails
          shell={view.shell}
          command={view.command}
          argsText={view.argsText}
          resultText={view.resultText}
          error={view.error}
          resultRef={resultRef}
        />
      )
    }
  }

  return (
    <ActivityRow
      icon={getToolIcon(name)}
      label={collapsedAttempt ? `${toolLabel(name)} attempted` : toolLabel(name)}
      summary={summary}
      stats={collapsedAttempt ? null : view.stats}
      running={view.running && !collapsedAttempt}
      error={view.error && !collapsedAttempt}
      hideMetaWhenOpen={Boolean(fileDiff || readPreview)}
    >
      {details}
    </ActivityRow>
  )
}

function ToolDetails({
  shell,
  command,
  argsText,
  resultText,
  error,
  resultRef,
}: {
  shell: boolean
  command: string
  argsText: string
  resultText: string
  error: boolean
  resultRef: RefObject<HTMLPreElement | null>
}) {
  if (shell) {
    return (
      <ShellBody command={command} resultText={resultText} error={error} resultRef={resultRef} />
    )
  }
  return (
    <>
      {argsText ? (
        <pre className="max-h-64 scroll-fade overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {argsText}
        </pre>
      ) : null}
      {resultText ? (
        <pre
          ref={resultRef}
          className={cn(
            'mt-2 max-h-64 scroll-fade overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap',
            error ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {resultText}
        </pre>
      ) : null}
    </>
  )
}

function ShellBody({
  command,
  resultText,
  error,
  resultRef,
}: {
  command: string
  resultText: string
  error: boolean
  resultRef: RefObject<HTMLPreElement | null>
}) {
  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border bg-muted/30 font-mono text-xs leading-relaxed">
      {command ? (
        <div className="flex gap-2 px-3 py-2">
          <span className="shrink-0 text-muted-foreground select-none">$</span>
          <span className="min-w-0 whitespace-pre-wrap">
            {tokenizeShell(command).map((token, index) => (
              <span key={index} className={TOKEN_CLASS[token.kind]}>
                {token.value}
              </span>
            ))}
          </span>
        </div>
      ) : null}
      {resultText ? (
        <pre
          ref={resultRef}
          className={cn(
            'max-h-64 scroll-fade overflow-auto border-t border-border px-3 py-2 whitespace-pre-wrap',
            error ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {resultText}
        </pre>
      ) : null}
    </div>
  )
}

function readEndLine(code: string, startLine: number): number {
  if (!code) return startLine
  const lines = code.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return startLine + Math.max(lines.length, 1) - 1
}

function ReadFile({ preview }: { preview: ReadPreview }) {
  return (
    <>
      <FileCard
        path={citationLabel({
          path: preview.path,
          start: preview.startLine,
          end: readEndLine(preview.code, preview.startLine),
        })}
        copy={preview.code}
      >
        <HighlightedCode
          source={preview.code}
          language={languageFromPath(preview.path)}
          startLine={preview.startLine}
        />
      </FileCard>
      {preview.notice ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">{preview.notice}</p>
      ) : null}
    </>
  )
}

function EditDiff({
  path,
  stats,
  lines,
}: {
  path: string
  stats?: DiffStats | null
  lines: DiffLine[]
}) {
  return (
    <FileCard path={path || 'Diff'} stats={stats} copy={formatDiffCopy(lines)}>
      <HighlightedDiff lines={lines} language={languageFromPath(path)} />
    </FileCard>
  )
}
