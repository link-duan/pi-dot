import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SettingSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      {title || description || action ? (
        <div className="flex items-center justify-between px-1">
          <div>
            {title ? <h3 className="text-xs font-medium text-muted-foreground">{title}</h3> : null}
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground/80">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function SettingCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'divide-y divide-border/40 overflow-hidden rounded-xl border border-border/60 bg-card/40 shadow-2xs backdrop-blur-xs transition-colors',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SettingRow({
  title,
  description,
  children,
  className,
  align = 'center',
}: {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
  align?: 'center' | 'start'
}) {
  return (
    <div
      className={cn(
        'flex justify-between gap-6 px-4 py-3 text-sm transition-colors hover:bg-muted/15',
        align === 'center' ? 'items-center' : 'items-start',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground">{title}</span>
        {description ? (
          <span className="text-xs leading-normal text-muted-foreground">{description}</span>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  )
}

export function StatusDot({
  status,
  pulse = false,
  className,
}: {
  status: 'online' | 'offline' | 'warning'
  pulse?: boolean
  className?: string
}) {
  const color =
    status === 'online'
      ? 'bg-emerald-500'
      : status === 'warning'
        ? 'bg-amber-500'
        : 'bg-muted-foreground/40'

  return (
    <span className={cn('relative flex size-2 shrink-0 items-center justify-center', className)}>
      {pulse && status === 'online' ? (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      ) : null}
      <span className={cn('relative inline-flex size-2 rounded-full', color)} />
    </span>
  )
}

export function SettingBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-border/50 bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}
