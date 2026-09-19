import type { MouseEventHandler } from 'react'
import { File, Folder } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FileChip({
  label,
  title,
  directory = false,
  selected = false,
  onMouseDown,
}: {
  label: string
  title?: string
  directory?: boolean
  selected?: boolean
  onMouseDown?: MouseEventHandler<HTMLSpanElement>
}) {
  const Icon = directory ? Folder : File
  return (
    <span
      aria-selected={selected}
      title={title}
      onMouseDown={onMouseDown}
      className={cn(
        'inline-flex h-5 max-w-full items-center gap-1 rounded-sm bg-muted px-1.5 align-middle text-xs font-medium text-foreground',
        selected && 'bg-accent text-accent-foreground ring-1 ring-ring',
      )}
    >
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  )
}
