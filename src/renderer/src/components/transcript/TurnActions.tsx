import { GitBranch } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import type { AgentMessage, MessageRef } from '@shared/protocol'
import { useChat, useSession } from '@/session/store'
import { CopyAction, MessageAction, RewindAction } from './MessageActions'

/** Copy, Fork and Rewind for a finished turn, before its status (`children`). */
export function TurnActions({
  messages,
  isLast,
  children,
}: {
  messages: AgentMessage[]
  /** The session already ends at the last turn, so rewinding to it would do nothing. */
  isLast: boolean
  children?: ReactNode
}) {
  const busy = useChat((chat) => chat.isStreaming)
  const forkMessage = useSession((state) => state.forkMessage)
  const hasText = messages.some(
    (message) =>
      message.role === 'assistant' &&
      message.content.some((block) => block.type === 'text' && /\S/.test(block.text)),
  )
  const last = messages.at(-1)
  const reply: MessageRef | undefined =
    last && last.role !== 'user' ? { role: last.role, timestamp: last.timestamp } : undefined

  return (
    <>
      {hasText || reply ? (
        <div className="-ml-1 flex shrink-0 items-center gap-0.5">
          {hasText ? <CopyAction text={() => replyText(messages)} label="Copy response" /> : null}
          {reply ? (
            <>
              <MessageAction
                icon={GitBranch}
                label={busy ? 'Stop and fork into a new session' : 'Fork into a new session'}
                onClick={() =>
                  void forkMessage(reply).then((forked) => {
                    if (forked) toast('Forked into a new session')
                  })
                }
              />
              {isLast ? null : <RewindAction message={reply} />}
            </>
          ) : null}
        </div>
      ) : null}
      {children}
    </>
  )
}

function replyText(messages: AgentMessage[]): string {
  return messages
    .flatMap((message) =>
      message.role === 'assistant'
        ? message.content.flatMap((block) => (block.type === 'text' ? [block.text.trim()] : []))
        : [],
    )
    .filter(Boolean)
    .join('\n\n')
}
