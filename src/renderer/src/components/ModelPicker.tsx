import { useMemo, useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { modelKey, type ModelInfo } from '@shared/protocol'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const itemType = "text-xs leading-4 [&_svg:not([class*='size-'])]:size-3"
const radioItem = cn(itemType, 'py-1 pl-2')

const INITIAL_DISPLAY_COUNT = 60
const SCROLL_BATCH_SIZE = 40

export function ModelPickerContent({
  models,
  value,
  onSelect,
  className,
}: {
  models: ModelInfo[]
  value?: string
  onSelect: (model: ModelInfo) => void
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT)

  const filteredModels = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return models
    return models.filter((item) => {
      const haystack = `${item.provider} ${item.name} ${item.id}`.toLowerCase()
      return (
        haystack.includes(needle) ||
        haystack.replace(/[-_]/g, ' ').includes(needle.replace(/[-_]/g, ' '))
      )
    })
  }, [models, query])

  const visibleModels = useMemo(() => {
    if (query.trim()) return filteredModels
    return filteredModels.slice(0, displayCount)
  }, [filteredModels, query, displayCount])

  return (
    <div className={cn('flex flex-col overflow-hidden', className)}>
      <div className="p-1 pb-0">
        <Input
          value={query}
          aria-label="Search models"
          placeholder="Search models..."
          className="h-6 px-2 text-xs md:text-xs"
          onChange={(event) => {
            setQuery(event.target.value)
            setDisplayCount(INITIAL_DISPLAY_COUNT)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter')
              return
            event.stopPropagation()
          }}
        />
      </div>
      <ScrollArea>
        <ScrollAreaViewport
          className="h-auto max-h-[min(calc(20rem-1.75rem),calc(var(--available-height)-1.75rem))] scroll-fade overscroll-contain py-1 pr-2.5 pl-1"
          onScroll={(event) => {
            const target = event.currentTarget
            if (target.scrollTop + target.clientHeight >= target.scrollHeight - 80) {
              setDisplayCount((prev) => Math.min(prev + SCROLL_BATCH_SIZE, filteredModels.length))
            }
          }}
        >
          {visibleModels.length === 0 ? (
            <div className="px-2 py-2 text-center text-xs text-muted-foreground">
              No matching models
            </div>
          ) : (
            <DropdownMenuRadioGroup
              value={value ?? ''}
              onValueChange={(val) => {
                const next = models.find((item) => modelKey(item) === val)
                if (next) onSelect(next)
              }}
            >
              {visibleModels.map((item) => (
                <DropdownMenuRadioItem
                  key={modelKey(item)}
                  value={modelKey(item)}
                  className={radioItem}
                >
                  <div className="flex min-w-0 flex-1 flex-col leading-4">
                    <span className="truncate">{item.name}</span>
                    <span className="truncate text-muted-foreground">{item.provider}</span>
                  </div>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
        </ScrollAreaViewport>
        <ScrollAreaScrollbar className="my-1" />
      </ScrollArea>
    </div>
  )
}

export function ModelPickerDropdown({
  models,
  value,
  onChange,
  placeholder = 'Select model…',
  disabled = false,
  className,
  triggerClassName,
}: {
  models: ModelInfo[]
  value?: string
  onChange: (key: string, model: ModelInfo) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
}) {
  const selected = models.find((item) => modelKey(item) === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        variant="ghost"
        size="sm"
        disabled={disabled}
        aria-label="Select model"
        className={cn(
          'h-7 max-w-sm gap-1.5 px-2 text-xs font-normal text-muted-foreground transition-colors duration-150 hover:text-foreground',
          'disabled:opacity-40',
          triggerClassName,
        )}
      >
        <span className={cn('min-w-0 truncate', selected && 'font-medium text-foreground')}>
          {selected?.name ?? placeholder}
        </span>
        <ChevronDownIcon className="pointer-events-none size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn('w-64 overflow-hidden p-0 text-xs', className)}
      >
        <ModelPickerContent
          models={models}
          value={value}
          onSelect={(next) => {
            onChange(modelKey(next), next)
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
