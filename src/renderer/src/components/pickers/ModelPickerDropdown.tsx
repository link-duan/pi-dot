import { ChevronDownIcon } from 'lucide-react'
import { modelKey, type ModelInfo } from '@shared/protocol'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ModelPickerContent } from './ModelPickerContent'

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
