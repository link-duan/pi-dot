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
      label={busy ? 'Stop and rewind to here' : 'Rewind the conversation to here'}
      onClick={() =>
        void rewindMessage(message).then((undo) => {
          if (undo) toast('Rewound the conversation', { action: { label: 'Undo', onClick: undo } })
        })
      }
    />
  )
}
