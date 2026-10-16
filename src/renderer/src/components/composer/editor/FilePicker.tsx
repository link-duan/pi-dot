import { useEffect, useRef } from 'react'
import { File, Folder } from 'lucide-react'
import type { FileHit } from '@shared/protocol'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@/components/ui/scroll-area'

export function FilePicker({
  hits,
  index,
  onHover,
  onSelect,
}: {
  hits: FileHit[]
  index: number
  onHover: (index: number) => void
  onSelect: (hit: FileHit) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const selected = hits[index]?.path ?? ''

  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-file-index="${index}"]`)
    item?.scrollIntoView({ block: 'nearest' })
  }, [index])

  return (
    <div
      className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-border bg-popover py-1.5 pl-1.5 text-popover-foreground shadow-md"
      onMouseDown={(event) => event.preventDefault()}
    >
      <ScrollArea>
        <ScrollAreaViewport
          ref={listRef}
          className="h-auto! max-h-64 scroll-fade overscroll-contain pr-2.5"
        >
          <Command shouldFilter={false} value={selected} className="overflow-visible">
            <CommandList className="overflow-visible p-0">
              {hits.length === 0 ? (
                <CommandEmpty className="py-4 text-xs">No matching files</CommandEmpty>
              ) : (
                <CommandGroup heading="Files">
                  {hits.map((hit, itemIndex) => {
                    const Icon = hit.isDirectory ? Folder : File
                    const name = hit.path.split('/').filter(Boolean).at(-1) ?? hit.path
                    return (
                      <CommandItem
                        key={hit.path}
                        value={hit.path}
                        data-file-index={itemIndex}
                        className="gap-2 px-2 py-1 text-xs"
                        onMouseEnter={() => onHover(itemIndex)}
                        onSelect={() => onSelect(hit)}
                      >
                        <Icon className="size-3 shrink-0 text-muted-foreground" />
                        <span className="shrink-0">{hit.isDirectory ? `${name}/` : name}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {hit.path}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar className="my-0.5" />
      </ScrollArea>
    </div>
  )
}
