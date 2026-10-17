import { useEffect, useRef } from 'react'
import type { CommandInfo, SkillInfo } from '@shared/protocol'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { filterSlashItems, type SlashItem, type SlashScope } from '@/lib/slash-query'
import { PickerPopup } from './PickerPopup'

export function SkillPicker({
  anchor,
  skills,
  commands,
  query,
  index,
  onHover,
  onSelect,
  scope,
}: {
  anchor: Element | null
  skills: SkillInfo[]
  /** Extension commands and prompt templates; null lists skills only. */
  commands: CommandInfo[] | null
  query: string
  index: number
  onHover: (index: number) => void
  onSelect: (item: SlashItem) => void
  scope?: SlashScope
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const filtered = filterSlashItems(skills, query, commands, scope)
  const selected = filtered[index] ? itemValue(filtered[index]) : ''
  const groups = [
    { heading: 'Commands', kind: 'command' },
    { heading: 'Extensions', kind: 'extension' },
    { heading: 'Skills', kind: 'skill' },
  ] as const

  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-skill-index="${index}"]`)
    item?.scrollIntoView({ block: 'nearest' })
  }, [index])

  return (
    <PickerPopup anchor={anchor} listRef={listRef}>
      <Command shouldFilter={false} value={selected} className="overflow-visible">
        <CommandList className="overflow-visible p-0">
          {filtered.length === 0 ? (
            <CommandEmpty className="py-4 text-xs">
              {commands ? 'No matching commands or skills' : 'No matching skills'}
            </CommandEmpty>
          ) : (
            groups.map(({ heading, kind }) => {
              const items = filtered.flatMap((item, itemIndex) =>
                item.kind === kind ? [{ item, itemIndex }] : [],
              )
              if (items.length === 0) return null
              return (
                <CommandGroup key={kind} heading={heading}>
                  {items.map(({ item, itemIndex }) => {
                    const { name, description, source } = itemLabel(item)
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
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {description}
                        </span>
                        {source ? (
                          <span className="shrink-0 rounded-full border border-border px-1.5 text-[11px] leading-4 text-muted-foreground">
                            {source}
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
    </PickerPopup>
  )
}

function itemValue(item: SlashItem): string {
  if (item.kind === 'command') return `command:${item.name}`
  if (item.kind === 'extension') return `extension:${item.command.name}`
  return `skill:${item.skill.name}`
}

function itemLabel(item: SlashItem): { name: string; description?: string; source?: string } {
  if (item.kind === 'command') return { name: `/${item.name}`, description: item.description }
  if (item.kind === 'extension') {
    const { name, description, source } = item.command
    return { name: `/${name}`, description, source: source === 'extension' ? 'ext' : 'prompt' }
  }
  return { name: item.skill.name, description: item.skill.description }
}
