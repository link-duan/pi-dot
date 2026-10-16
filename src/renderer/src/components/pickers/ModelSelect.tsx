import { ChevronDownIcon } from 'lucide-react'
import {
  isThinkingLevel,
  modelKey,
  THINKING_LEVEL_LABELS,
  type ThinkingLevel,
} from '@shared/protocol'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useSession } from '@/session/store'
import { BUTTON_RADIUS } from '@/components/composer/card'
import { ModelPickerContent } from './ModelPickerContent'

const itemType = "text-xs leading-4 [&_svg:not([class*='size-'])]:size-3"
const subTrigger = cn(itemType, 'gap-2 px-2 py-1')
const radioItem = cn(itemType, 'py-1 pl-2')

export function ModelSelect({ className }: { className?: string } = {}) {
  const models = useSession((state) => state.models)
  const model = useSession((state) => state.model)
  const thinkingLevel = useSession((state) => state.thinkingLevel)
  const thinkingLevels = useSession((state) => state.thinkingLevels)
  const connection = useSession((state) => state.connection)
  const setModel = useSession((state) => state.setModel)
  const setThinkingLevel = useSession((state) => state.setThinkingLevel)
  const disabled = connection !== 'ready' || models.length === 0

  return (
    <DropdownMenu disabled={disabled}>
      <DropdownMenuTrigger
        variant="ghost"
        size="sm"
        aria-label="Select model and thinking level"
        disabled={disabled}
        className={cn(
          BUTTON_RADIUS,
          'h-7 max-w-64 min-w-0 gap-2 py-0 pr-1 pl-1.5 text-xs leading-4 text-muted-foreground transition-colors duration-150 disabled:opacity-40',
          className,
        )}
      >
        <span className="min-w-0 truncate text-muted-foreground">
          {model?.name ?? 'Select model'}
        </span>
        {model ? (
          <span className="shrink-0 text-muted-foreground">
            {THINKING_LEVEL_LABELS[thinkingLevel]}
          </span>
        ) : null}
        <ChevronDownIcon className="pointer-events-none -ml-1 size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-48 p-1 text-xs" sideOffset={6}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={subTrigger}>
            <span className="shrink-0">Thinking</span>
            <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">
              {THINKING_LEVEL_LABELS[thinkingLevel]}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-32 p-1 text-xs">
            <DropdownMenuRadioGroup
              value={thinkingLevel}
              onValueChange={(value) => {
                if (isThinkingLevel(value)) void setThinkingLevel(value)
              }}
            >
              {thinkingLevels.map((level: ThinkingLevel) => (
                <DropdownMenuRadioItem key={level} value={level} className={radioItem}>
                  {THINKING_LEVEL_LABELS[level]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator className="my-0.5" />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={subTrigger}>
            <span className="shrink-0">Model</span>
            <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">
              {model?.name ?? 'None'}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64 overflow-hidden p-0 text-xs">
            <ModelPickerContent
              models={models}
              value={model ? modelKey(model) : ''}
              onSelect={(next) => void setModel(next.provider, next.id)}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
