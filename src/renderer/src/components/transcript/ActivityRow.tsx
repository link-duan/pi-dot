import { AlertCircle, ChevronRight, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import type { DiffStats } from '@/components/transcript/tool/diff'
import { cn } from '@/lib/utils'
import { DiffStatsLabel } from './DiffStatsLabel'

export function ActivityRow({
  icon: Icon,
  label,
  summary,
  summaryIsCode = false,
  meta,
  stats,
  running,
  error,
  open: openProp,
  defaultOpen = false,
  hideMetaWhenOpen = false,
  animateIn = false,
  onOpenChange,
  children,
}: {
  icon: LucideIcon
  label: string
  /**
   * A node summary paints its own shimmer and truncates its own text: `background-clip: text` on
   * an ancestor clips to the text where it was laid out, so moving text under it would show unmoved.
   */
  summary: ReactNode
  /** Commands, paths and patterns: set in the code face, like inline code in prose. */
  summaryIsCode?: boolean
  meta?: string
  stats?: DiffStats | null
  running?: boolean
  error?: boolean
  open?: boolean
  defaultOpen?: boolean
  hideMetaWhenOpen?: boolean
  animateIn?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}) {
  const [initialAnimate] = useState(() => animateIn)
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const expandable = Boolean(children)
  const open = openProp ?? userOpen ?? (expandable && defaultOpen)

  const iconSlot = (
    <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
      {error ? (
        <AlertCircle className="size-3.5 text-destructive" />
      ) : (
        <Icon className="size-3.5" />
      )}
    </span>
  )

  const showMeta = !(open && hideMetaWhenOpen)
  const nodeSummary = showMeta && summary != null && typeof summary === 'object'
  const text = (
    <span className="flex min-w-0 items-baseline gap-2">
      <span
        className={cn(
          'flex min-w-0 items-baseline gap-2',
          running && 'text-muted-foreground',
          running && !nodeSummary && 'shimmer',
        )}
      >
        <span
          className={cn(
            'whitespace-nowrap',
            running && nodeSummary && 'shimmer',
            error ? 'text-destructive' : !running && 'text-foreground/75',
            summary ? 'shrink-0' : 'min-w-0 truncate',
          )}
        >
          {label}
        </span>
        {showMeta && summary ? (
          <span
            className={cn(
              // A node summary truncates its own text; clipping only across leaves it room to move.
              nodeSummary ? 'min-w-0 overflow-x-clip' : 'min-w-0 truncate',
              summaryIsCode && 'font-mono text-[0.85em]',
              !running && 'text-muted-foreground',
            )}
          >
            {summary}
          </span>
        ) : null}
      </span>
      {showMeta && meta ? (
        <span className="shrink-0 text-subtle-foreground tabular-nums">{meta}</span>
      ) : null}
      {showMeta && stats ? <DiffStatsLabel stats={stats} /> : null}
      {expandable ? (
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 self-center text-muted-foreground transition-transform duration-200 ease-out',
            open ? 'rotate-90 opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        />
      ) : null}
    </span>
  )

  return (
    <div className={cn('py-1.5', initialAnimate && 'animate-blur-reveal')}>
      {!expandable ? (
        <div className="inline-flex max-w-full items-center gap-2">
          {iconSlot}
          {text}
        </div>
      ) : (
        <CollapsiblePrimitive.Root
          open={open}
          onOpenChange={(next) => {
            onOpenChange?.(next)
            if (openProp === undefined) setUserOpen(next)
          }}
        >
          <CollapsiblePrimitive.Trigger className="group inline-flex max-w-full items-center gap-2 rounded-sm p-0 text-left select-none focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:outline-none">
            {iconSlot}
            {text}
          </CollapsiblePrimitive.Trigger>
          <CollapsiblePrimitive.Panel className="h-(--collapsible-panel-height) overflow-hidden pl-1 transition-[height,opacity] duration-200 ease-out select-text data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0">
            {children}
          </CollapsiblePrimitive.Panel>
        </CollapsiblePrimitive.Root>
      )}
    </div>
  )
}
