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
import {
  asText,
  formatDiffCopy,
  prettyJson,
  toolDiffStats,
  toolEditDiff,
  toolLabel,
  toolSummary,
  type DiffLine,
  type DiffStats,
} from '@/lib/format'
import { tokenizeShell, type ShellTokenKind } from '@/lib/shell-highlight'
import { cn } from '@/lib/utils'
import { useSession } from '@/session/store'
import { CodeBlockCopyButton } from 'streamdown'
import { ActivityRow, DiffStatsLabel } from './ActivityRow'

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
  const editDiff = isEditTool(name) ? toolEditDiff(view.payload, live?.result ?? result) : null
  const summary = toolSummary(name, view.payload, cwd, window.pi.homedir)

  useEffect(() => {
    if (!view.running) return
    const node = resultRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [view.running, view.resultText])

  return (
    <ActivityRow
      icon={getToolIcon(name)}
      label={toolLabel(name)}
      summary={summary}
      stats={view.stats}
      running={view.running}
      error={view.error}
      hideMetaWhenOpen={Boolean(editDiff)}
    >
      {editDiff ? (
        <>
          <EditDiff path={summary} stats={view.stats} lines={editDiff} />
          {view.error && view.resultText ? (
            <pre className="mt-2 max-h-64 scroll-fade overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-destructive">
              {view.resultText}
            </pre>
          ) : null}
        </>
      ) : view.hasDetails ? (
        <ToolDetails
          shell={view.shell}
          command={view.command}
          argsText={view.argsText}
          resultText={view.resultText}
          error={view.error}
          resultRef={resultRef}
        />
      ) : null}
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

const DIFF_LINE_CLASS: Record<DiffLine['kind'], string> = {
  add: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  remove: 'bg-destructive/10 text-destructive',
  context: 'text-muted-foreground',
}

function diffLineNumber(line: DiffLine): number | undefined {
  if (line.kind === 'remove') return line.oldLine
  return line.newLine ?? line.oldLine
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
  const copy = formatDiffCopy(lines)
  const gutterCh = Math.max(1, ...lines.map((line) => String(diffLineNumber(line) ?? '').length))
  return (
    <div data-file-card="">
      <div
        className="mt-2 w-full rounded-xl border border-border bg-sidebar pt-2"
        data-streamdown="code-block"
      >
        <div className="flex min-w-0 items-baseline gap-2 px-2" data-streamdown="code-block-header">
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground normal-case">
            {path || 'Diff'}
          </span>
          {stats ? <DiffStatsLabel stats={stats} /> : null}
        </div>
        <div className="px-2">
          <div data-streamdown="code-block-actions">
            <CodeBlockCopyButton code={copy} />
          </div>
        </div>
        <div
          className="max-h-96 overflow-auto font-mono text-xs leading-relaxed"
          data-streamdown="code-block-body"
        >
          {lines.map((line, index) => (
            <div
              key={index}
              className={cn(
                'flex items-baseline gap-2 py-px pr-2 whitespace-pre-wrap',
                DIFF_LINE_CLASS[line.kind],
                line.hunkStart && 'mt-2',
              )}
            >
              <span className="shrink-0 px-2 text-right text-[10px] text-muted-foreground/50 tabular-nums select-none">
                <span className="inline-block" style={{ width: `${gutterCh}ch` }}>
                  {diffLineNumber(line) ?? ''}
                </span>
              </span>
              <span className="w-3 shrink-0 select-none">
                {line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '}
              </span>
              <span className="min-w-0">{line.text || ' '}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
