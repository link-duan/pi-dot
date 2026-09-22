import { AlertCircle, ChevronRight, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import type { DiffStats } from './tool/diff'
import { cn } from '@/lib/utils'

export function DiffStatsLabel({ stats }: { stats: DiffStats }) {
  if (stats.added <= 0 && stats.removed <= 0) return null
  return (
    <span className="shrink-0 font-mono text-xs tabular-nums">
      {stats.added > 0 ? (
        <span className="text-emerald-600 dark:text-emerald-400">+{stats.added}</span>
      ) : null}
      {stats.added > 0 && stats.removed > 0 ? ' ' : null}
      {stats.removed > 0 ? <span className="text-destructive">-{stats.removed}</span> : null}
    </span>
  )
}

export function ActivityRow({
  icon: Icon,
  label,
  summary,
  stats,
  running,
  error,
  open: openProp,
  defaultOpen = false,
  hideMetaWhenOpen = false,
  onOpenChange,
  children,
}: {
  icon: LucideIcon
  label: string
  summary: string
  stats?: DiffStats | null
  running?: boolean
  error?: boolean
  open?: boolean
  defaultOpen?: boolean
  hideMetaWhenOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}) {
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
  const text = (
    <span className="flex min-w-0 items-baseline gap-2">
      <span
        className={cn(
          'flex min-w-0 items-baseline gap-2',
          running && 'shimmer text-muted-foreground',
        )}
      >
        <span
          className={cn(
            'whitespace-nowrap',
            error ? 'text-destructive' : !running && 'text-foreground/75',
            summary ? 'shrink-0' : 'min-w-0 truncate',
          )}
        >
          {label}
        </span>
        {showMeta && summary ? (
          <span className={cn('min-w-0 truncate', !running && 'text-muted-foreground')}>
            {summary}
          </span>
        ) : null}
      </span>
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

  if (!expandable) {
    return (
      <div className="py-1.5">
        <div className="inline-flex max-w-full items-center gap-2">
          {iconSlot}
          {text}
        </div>
      </div>
    )
  }

  return (
    <CollapsiblePrimitive.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange?.(next)
        if (openProp === undefined) setUserOpen(next)
      }}
      className="py-1.5"
    >
      <CollapsiblePrimitive.Trigger className="group inline-flex max-w-full items-center gap-2 rounded-sm p-0 text-left select-none focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:outline-none">
        {iconSlot}
        {text}
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Panel className="h-(--collapsible-panel-height) overflow-hidden pl-1 transition-[height,opacity] duration-200 ease-out select-text data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0">
        {children}
      </CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
  )
}
