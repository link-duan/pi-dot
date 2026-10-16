import { cn } from '@/lib/utils'

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
        ? 'bg-warning'
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
