import { useEffect, useRef } from 'react'
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
import { asText, prettyJson, toolLabel, toolSummary } from '@/lib/format'
import { useSession } from '@/session/store'
import { ActivityRow } from './ActivityRow'

function getToolIcon(name: string): LucideIcon {
  const lower = name.toLowerCase()
  if (
    lower === 'bash' ||
    lower.includes('command') ||
    lower.includes('exec') ||
    lower.includes('shell')
  ) {
    return Terminal
  }
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

export function ToolCard({
  name,
  args,
  live,
  pending,
}: {
  name: string
  args: unknown
  live?: ToolLiveState
  pending?: boolean
}) {
  const cwd = useSession((state) => state.cwd)
  const resultRef = useRef<HTMLPreElement>(null)
  const running = live?.status === 'running' || (pending && live?.status !== 'done')
  const result = live?.result ?? live?.partialResult
  const resultText = asText(result)
  const error = Boolean(live?.isError)
  const payload = live?.args ?? args
  const argsText = prettyJson(payload)
  const hasArgs = Boolean(argsText) && argsText !== '{}' && argsText !== 'null'
  const hasDetails = hasArgs || Boolean(resultText)

  useEffect(() => {
    if (!running) return
    const node = resultRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [running, resultText])

  return (
    <ActivityRow
      icon={getToolIcon(name)}
      label={toolLabel(name)}
      summary={toolSummary(name, payload, cwd, window.pi.homedir)}
      running={running}
      error={error}
    >
      {hasDetails ? (
        <>
          {hasArgs ? (
            <pre className="max-h-64 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {argsText}
            </pre>
          ) : null}
          {resultText ? (
            <pre
              ref={resultRef}
              className={`mt-2 max-h-64 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap ${
                error ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {resultText}
            </pre>
          ) : null}
        </>
      ) : null}
    </ActivityRow>
  )
}
