import type { MouseEventHandler } from 'react'
import { File, Folder, ImageIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { isClipboardImage } from '@/lib/file-token'
import { isImageFile } from '@/lib/path'
import { cn } from '@/lib/utils'
import { useImagePreview } from './useImagePreview'

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
  const path = title ?? label
  const image = !directory && isImageFile(path)
  const preview = useImagePreview(image ? path : null)
  const Icon = directory ? Folder : image ? ImageIcon : File
  const chipClass = cn(
    'inline-flex h-5 max-w-full items-center gap-1 rounded-sm bg-muted px-1.5 align-middle text-xs font-medium text-foreground',
    selected && 'bg-accent text-accent-foreground ring-1 ring-ring',
    className,
  )
  const body = (
    <>
      {preview ? (
        <img src={preview.src} alt="" className="size-3.5 shrink-0 rounded-[3px] object-cover" />
      ) : (
        <Icon className="size-3 shrink-0" />
      )}
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
      {preview ? (
        <TooltipContent className="max-w-[25rem] flex-col items-stretch gap-1.5 p-1.5">
          <img src={preview.src} alt="" className="max-h-75 max-w-full rounded-md object-contain" />
          <span className="flex justify-between gap-3 px-1 text-muted-foreground">
            <span className="min-w-0 truncate">
              {isClipboardImage(path) ? 'Pasted image' : title}
            </span>
            <span className="shrink-0 tabular-nums">
              {preview.width}×{preview.height}
            </span>
          </span>
        </TooltipContent>
      ) : (
        <TooltipContent className="break-all">{title}</TooltipContent>
      )}
    </Tooltip>
  )
}
