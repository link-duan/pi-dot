import type { MouseEventHandler } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SkillChip({
  name,
  selected = false,
  onMouseDown,
}: {
  name: string
  selected?: boolean
  onMouseDown?: MouseEventHandler<HTMLSpanElement>
}) {
  return (
    <span
      aria-selected={selected}
      onMouseDown={onMouseDown}
      className={cn(
        'inline-flex h-5 max-w-full items-center gap-1 rounded-sm bg-muted px-1.5 align-middle text-xs font-medium text-foreground',
        selected && 'bg-accent text-accent-foreground ring-1 ring-ring',
      )}
    >
      <Sparkles className="size-3 shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  )
}
