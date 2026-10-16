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
