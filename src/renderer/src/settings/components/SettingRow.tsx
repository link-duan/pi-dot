import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
