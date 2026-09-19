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
import { filterSkills } from '@/lib/slash-query'

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
  onSelect: (skill: SkillInfo) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const filtered = filterSkills(skills, query)
  const selected = filtered[index]?.name ?? ''

  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-skill-index="${index}"]`)
    item?.scrollIntoView({ block: 'nearest' })
  }, [index])

  return (
    <div
      className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-border/80 bg-popover py-1.5 pl-1.5 text-popover-foreground shadow-md"
      onMouseDown={(event) => event.preventDefault()}
    >
      <ScrollArea>
        <ScrollAreaViewport ref={listRef} className="h-auto! max-h-64 scroll-fade pr-2.5">
          <Command shouldFilter={false} value={selected} className="overflow-visible">
            <CommandList className="overflow-visible p-0">
              {filtered.length === 0 ? (
                <CommandEmpty className="py-4 text-xs">No matching skills</CommandEmpty>
              ) : (
                <CommandGroup heading="Skills">
                  {filtered.map((skill, itemIndex) => (
                    <CommandItem
                      key={skill.name}
                      value={skill.name}
                      data-skill-index={itemIndex}
                      className="gap-2 px-2 py-1 text-xs"
                      onMouseEnter={() => onHover(itemIndex)}
                      onSelect={() => onSelect(skill)}
                    >
                      <span className="shrink-0">{skill.name}</span>
                      {skill.description ? (
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {skill.description}
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
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
