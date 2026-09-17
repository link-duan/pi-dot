import { AlertCircle, ChevronRight, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export function ActivityRow({
  icon: Icon,
  label,
  summary,
  running,
  error,
  children,
}: {
  icon: LucideIcon
  label: string
  summary: string
  running?: boolean
  error?: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const expandable = Boolean(children)

  const iconSlot = (
    <span className="relative flex size-4 shrink-0 items-center justify-center text-muted-foreground">
      {open ? (
        <ChevronRight className="size-3.5 rotate-90" />
      ) : (
        <>
          <span
            className={cn(
              'flex items-center justify-center',
              expandable && 'group-hover/row:invisible',
            )}
          >
            {running ? (
              <Spinner className="size-3.5" />
            ) : error ? (
              <AlertCircle className="size-3.5 text-destructive" />
            ) : (
              <Icon className="size-3.5" />
            )}
          </span>
          {expandable ? (
            <ChevronRight className="pointer-events-none invisible absolute inset-0 m-auto size-3.5 group-hover/row:visible" />
          ) : null}
        </>
      )}
    </span>
  )

  const text = (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          'shrink-0 whitespace-nowrap',
          error ? 'text-destructive' : 'text-foreground/75',
        )}
      >
        {label}
      </span>
      {summary ? <span className="min-w-0 truncate text-muted-foreground">{summary}</span> : null}
    </span>
  )

  return (
    <div className="py-1">
      {expandable ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="group/row inline-flex max-w-full items-center gap-2 rounded-sm p-0 text-left text-[13px] leading-4 select-none focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          {iconSlot}
          {text}
        </button>
      ) : (
        <div className="inline-flex max-w-full items-center gap-2 text-[13px] leading-4">
          {iconSlot}
          {text}
        </div>
      )}
      {open && expandable ? <div className="pb-2 pl-6 select-text">{children}</div> : null}
    </div>
  )
}
