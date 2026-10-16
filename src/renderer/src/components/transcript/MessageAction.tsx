import { type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** A ghost icon button with a tooltip, for the actions under a message or a turn. */
export function MessageAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon
  label: ReactNode
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={typeof label === 'string' ? label : undefined}
            onClick={onClick}
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Icon />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
