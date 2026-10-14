import { useState, type ReactNode } from 'react'
import { Check, Copy, Undo2, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { MessageRef } from '@shared/protocol'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useChat, useSession } from '@/session/store'

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

/** Rewinds the conversation to `message`, with an Undo in the toast. */
export function RewindAction({ message }: { message: MessageRef }) {
  const busy = useChat((chat) => chat.isStreaming)
  const rewindMessage = useSession((state) => state.rewindMessage)
  return (
    <MessageAction
      icon={Undo2}
      label={busy ? 'Available when the run ends' : 'Rewind the conversation to here'}
      disabled={busy}
      onClick={() =>
        void rewindMessage(message).then((undo) => {
          if (undo) toast('Rewound the conversation', { action: { label: 'Undo', onClick: undo } })
        })
      }
    />
  )
}
