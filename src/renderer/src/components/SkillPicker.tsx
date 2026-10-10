import { useEffect, useRef } from 'react'
import type { SkillInfo } from '@shared/protocol'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@/components/ui/scroll-area'
import { filterSlashItems, type SlashItem } from '@/lib/slash-query'

export function SkillPicker({
  skills,
  query,
  index,
  onHover,
  onSelect,
}: {
  skills: SkillInfo[]
  query: string
  index: number
  onHover: (index: number) => void
  onSelect: (item: SlashItem) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const filtered = filterSlashItems(skills, query)
  const selected = filtered[index] ? itemValue(filtered[index]) : ''
  const groups = [
    { heading: 'Commands', kind: 'command' },
    { heading: 'Skills', kind: 'skill' },
  ] as const

  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-skill-index="${index}"]`)
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
              {filtered.length === 0 ? (
                <CommandEmpty className="py-4 text-xs">No matching commands or skills</CommandEmpty>
              ) : (
                groups.map(({ heading, kind }) => {
                  const items = filtered.flatMap((item, itemIndex) =>
                    item.kind === kind ? [{ item, itemIndex }] : [],
                  )
                  if (items.length === 0) return null
                  return (
                    <CommandGroup key={kind} heading={heading}>
                      {items.map(({ item, itemIndex }) => {
                        const name = item.kind === 'command' ? `/${item.name}` : item.skill.name
                        const description =
                          item.kind === 'command' ? item.description : item.skill.description
                        return (
                          <CommandItem
                            key={itemValue(item)}
                            value={itemValue(item)}
                            data-skill-index={itemIndex}
                            className="gap-2 px-2 py-1 text-xs"
                            onMouseEnter={() => onHover(itemIndex)}
                            onSelect={() => onSelect(item)}
                          >
                            <span className="shrink-0">{name}</span>
                            {description ? (
                              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                {description}
                              </span>
                            ) : null}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  )
                })
              )}
            </CommandList>
          </Command>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar className="my-0.5" />
      </ScrollArea>
    </div>
  )
}

function itemValue(item: SlashItem): string {
  return item.kind === 'command' ? `command:${item.name}` : `skill:${item.skill.name}`
}
