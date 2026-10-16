import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { UiWidget, WidgetPlacement } from '@shared/protocol'
import { AnsiText } from './AnsiText'
import { cn } from '@/lib/utils'
import { useChat } from '@/session/store'
import { stripAnsi } from './strip-ansi'

const WIDGET_LINES = 10

/**
 * Text widgets extensions set with `ctx.ui.setWidget`: above the editor as a card over the
 * Composer that scrolls past 8 lines, below it inside the Composer.
 */
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
  const scrolls = placement === 'aboveEditor'
  return (
    <div className={className}>
      <div
        className={cn(
          'flex flex-col gap-1',
          scrolls && 'max-h-40 scroll-fade overflow-y-auto overscroll-contain',
        )}
      >
        {widgets.map((widget) => (
          <Widget key={widget.key} widget={widget} collapsible={!scrolls} />
        ))}
      </div>
    </div>
  )
}

function Widget({ widget, collapsible }: { widget: UiWidget; collapsible: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const extra = collapsible ? widget.lines.length - WIDGET_LINES : 0
  const lines = expanded || !collapsible ? widget.lines : widget.lines.slice(0, WIDGET_LINES)
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
