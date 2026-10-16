import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SettingCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'divide-y divide-border/40 overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-xs transition-colors',
        className,
      )}
    >
      {children}
    </div>
  )
}
