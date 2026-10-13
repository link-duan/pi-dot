import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { UiWidget, WidgetPlacement } from '@shared/protocol'
import { ansiStyleToCss, parseAnsi } from '@/lib/ansi'
import { cn } from '@/lib/utils'
import { useChat } from '@/session/store'

const WIDGET_LINES = 10

/** Text widgets extensions set with `ctx.ui.setWidget`, inside the Composer around the editor. */
export function ExtensionWidgets({
  placement,
  className,
}: {
  placement: WidgetPlacement
  className?: string
}) {
  const widgets = useChat(
    useShallow((chat) => chat.ui.widgets.filter((widget) => widget.placement === placement)),
  )
  if (widgets.length === 0) return null
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {widgets.map((widget) => (
        <Widget key={widget.key} widget={widget} />
      ))}
    </div>
  )
}

function Widget({ widget }: { widget: UiWidget }) {
  const [expanded, setExpanded] = useState(false)
  const extra = widget.lines.length - WIDGET_LINES
  const lines = expanded ? widget.lines : widget.lines.slice(0, WIDGET_LINES)
  return (
    <div className="font-mono text-xs leading-5 text-muted-foreground">
      {lines.map((line, index) => (
        <div key={index} className="min-h-5 truncate whitespace-pre" title={stripAnsi(line)}>
          <AnsiText text={line} />
        </div>
      ))}
      {extra > 0 ? (
        <button
          type="button"
          className="font-sans text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : `+${extra} more lines`}
        </button>
      ) : null}
    </div>
  )
}

/** The Composer footer's extension statuses. */
export function ExtensionStatuses() {
  const statuses = Object.entries(useChat((chat) => chat.ui.statuses))
  return (
    <>
      {statuses.length > 0 ? (
        <span
          className="ml-1 flex min-w-0 items-center gap-2 overflow-hidden text-xs whitespace-nowrap text-muted-foreground select-none"
          title={statuses.map(([, text]) => stripAnsi(text)).join('  ')}
        >
          {statuses.map(([key, text]) => (
            <span key={key} className="shrink-0">
              <AnsiText text={text} />
            </span>
          ))}
        </span>
      ) : null}
    </>
  )
}

function AnsiText({ text }: { text: string }) {
  return parseAnsi(text).map((span, index) => (
    <span key={index} style={ansiStyleToCss(span.style)}>
      {span.text}
    </span>
  ))
}

function stripAnsi(text: string): string {
  return parseAnsi(text)
    .map((span) => span.text)
    .join('')
}
