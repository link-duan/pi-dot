import { RotateCcw } from 'lucide-react'
import type { AgentMessage } from '@shared/protocol'
import { Button } from '@/components/ui/button'
import { useSession } from '@/session/store'
import { CopyAction, MessageAction } from './MessageActions'

/** Copy and Retry for a finished turn; shown on hover, and Retry always after an error. */
export function TurnActions({
  messages,
  canRetry,
}: {
  messages: AgentMessage[]
  canRetry: boolean
}) {
  const retryLast = useSession((state) => state.retryLast)
  const last = messages.at(-1)
  const failed = canRetry && last?.role === 'assistant' && last.stopReason === 'error'
  const text = () =>
    messages
      .flatMap((message) =>
        message.role === 'assistant'
          ? message.content.flatMap((block) => (block.type === 'text' ? [block.text.trim()] : []))
          : [],
      )
      .filter(Boolean)
      .join('\n\n')

  return (
    <div className="mt-0.5 flex shrink-0 items-center gap-0.5">
      {failed ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-foreground"
          onClick={() => void retryLast()}
        >
          <RotateCcw />
          Retry
        </Button>
      ) : null}
      <div className="flex items-center opacity-0 transition-opacity duration-150 group-hover/turn:opacity-100 focus-within:opacity-100">
        <CopyAction text={text} label="Copy response" />
        {canRetry && !failed ? (
          <MessageAction icon={RotateCcw} label="Retry" onClick={() => void retryLast()} />
        ) : null}
      </div>
    </div>
  )
}
