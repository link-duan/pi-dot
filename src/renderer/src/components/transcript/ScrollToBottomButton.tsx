import { ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function ScrollToBottomButton({
  visible,
  onClick,
}: {
  visible: boolean
  onClick: () => void
}) {
  return (
    <div
      className={cn(
        'absolute bottom-7 left-1/2 z-20 -translate-x-1/2 transition-all duration-200 ease-out',
        visible
          ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none translate-y-2 scale-95 opacity-0',
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-full border-border/80 bg-background/90 text-foreground/80 shadow-md backdrop-blur-xs hover:bg-muted hover:text-foreground"
              aria-label="Scroll to bottom"
              onClick={onClick}
            />
          }
        >
          <ArrowDown className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="top">Scroll to bottom</TooltipContent>
      </Tooltip>
    </div>
  )
}
