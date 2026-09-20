import { useEffect, useRef } from 'react'
import type { ToolLiveState } from '@/chat/state'
import {
  isCollapsedToolAttempt,
  toolEditDiff,
  toolLabel,
  toolReadPreview,
  toolSummary,
  toolWriteDiff,
} from '@/lib/format'
import { useSession } from '@/session/store'
import { ActivityRow } from '../ActivityRow'
import { EditDiff } from './EditDiff'
import { getToolIcon, isReadTool, isEditTool, isWriteTool, toolView } from './kind'
import { ReadFile } from './ReadFile'
import { ShellBody } from './ShellBody'
import { ToolDetails } from './ToolDetails'

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
  const scrollRef = useRef<HTMLDivElement>(null)
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
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [view.running, view.resultText])

  let details = null
  if (!collapsedAttempt) {
    if (fileDiff) details = <EditDiff path={summary} stats={view.stats} lines={fileDiff} />
    else if (readPreview) details = <ReadFile preview={readPreview} />
    else if (isReadTool(name) && view.error) {
      details = view.resultText ? (
        <p className="mt-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {view.resultText}
        </p>
      ) : null
    } else if (view.shell) {
      details = (
        <ShellBody
          command={view.command}
          resultText={view.resultText}
          error={view.error}
          scrollRef={scrollRef}
        />
      )
    } else if (view.hasDetails && !isWriteTool(name)) {
      details = (
        <ToolDetails
          argsText={view.argsText}
          resultText={view.resultText}
          error={view.error}
          scrollRef={scrollRef}
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
      error={view.error && !collapsedAttempt && !view.shell && !isReadTool(name)}
      hideMetaWhenOpen={Boolean(fileDiff || readPreview)}
    >
      {details}
    </ActivityRow>
  )
}
