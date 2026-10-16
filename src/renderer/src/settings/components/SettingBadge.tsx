import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
