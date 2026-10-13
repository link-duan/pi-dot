import { useState, type ReactNode } from 'react'
import { Check, Copy, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** A ghost icon button with a tooltip, for the actions under a message or a turn. */
export function MessageAction({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: LucideIcon
  label: ReactNode
  disabled?: boolean
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
            // A disabled button gets no hover, so its tooltip could not say why.
            aria-disabled={disabled}
            onClick={disabled ? undefined : onClick}
            className="text-muted-foreground hover:text-foreground aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted-foreground"
          />
        }
      >
        <Icon />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function CopyAction({ text, label = 'Copy' }: { text: () => string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <MessageAction
      icon={copied ? Check : Copy}
      label={copied ? 'Copied' : label}
      onClick={() => {
        void navigator.clipboard.writeText(text()).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    />
  )
}
