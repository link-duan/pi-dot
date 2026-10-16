import { OctagonX, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ExtensionLine } from '@/chat/state'
import type { NotifyLevel } from '@shared/protocol'
import { AnsiText } from '@/components/extension/AnsiText'
import { cn } from '@/lib/utils'
import { CommandRow } from './CommandRow'

const NOTICE_ICONS: Partial<Record<NotifyLevel, LucideIcon>> = {
  warning: TriangleAlert,
  error: OctagonX,
}

/**
 * An extension command the user ran, what an extension said with `ctx.ui.notify`, or an
 * extension that threw; the last two in monospace, as extensions align text for a terminal.
 */
export function ExtensionLineRow({ line }: { line: ExtensionLine }) {
  if (line.kind === 'command') return <CommandRow text={line.text} />
  const level = line.kind === 'error' ? 'error' : line.level
  const Icon = NOTICE_ICONS[level]
  return (
    <div
      className={cn(
        'my-2 flex gap-2 font-mono text-xs leading-5 text-muted-foreground',
        level === 'warning' && 'text-plan',
        level === 'error' && 'text-destructive',
      )}
    >
      {Icon ? <Icon className="mt-[3px] size-3.5 shrink-0" /> : null}
      <div className="min-w-0 break-words whitespace-pre-wrap select-text">
        {line.kind === 'notice' ? (
          <AnsiText text={line.message} />
        ) : (
          <>
            {`Extension "${line.extensionPath}" error: ${line.message}`}
            {line.count > 1 ? (
              <span className="ml-2 text-muted-foreground tabular-nums">×{line.count}</span>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
