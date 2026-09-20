import type { MouseEventHandler } from 'react'
import { File, Folder } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function FileChip({
  label,
  title,
  directory = false,
  selected = false,
  onMouseDown,
  className,
}: {
  label: string
  title?: string
  directory?: boolean
  selected?: boolean
  onMouseDown?: MouseEventHandler<HTMLSpanElement>
  className?: string
}) {
  const Icon = directory ? Folder : File
  const chipClass = cn(
    'inline-flex h-5 max-w-full items-center gap-1 rounded-sm bg-muted px-1.5 align-middle text-xs font-medium text-foreground',
    selected && 'bg-accent text-accent-foreground ring-1 ring-ring',
    className,
  )
  const body = (
    <>
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </>
  )
  if (!title) {
    return (
      <span aria-selected={selected} onMouseDown={onMouseDown} className={chipClass}>
        {body}
      </span>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        aria-selected={selected}
        onMouseDown={onMouseDown}
        className={chipClass}
      >
        {body}
      </TooltipTrigger>
      <TooltipContent className="break-all">{title}</TooltipContent>
    </Tooltip>
  )
}
