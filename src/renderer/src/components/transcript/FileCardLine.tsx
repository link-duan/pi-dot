import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** One numbered row of a code or diff view. */
export function FileCardLine({
  n,
  gutterCh,
  marker,
  className,
  children,
}: {
  n?: number
  gutterCh: number
  marker?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex items-baseline gap-2 py-px pr-2 whitespace-pre-wrap', className)}>
      <span className="shrink-0 px-2 text-right text-xs text-muted-foreground/50 tabular-nums select-none">
        <span className="inline-block" style={{ width: `${gutterCh}ch` }}>
          {n ?? ''}
        </span>
      </span>
      {marker != null ? <span className="w-3 shrink-0 select-none">{marker}</span> : null}
      <span className="min-w-0">{children}</span>
    </div>
  )
}
