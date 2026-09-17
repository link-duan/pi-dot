import { memo, useEffect, useRef, type RefObject } from 'react'
import { Brain } from 'lucide-react'
import { userText, type ToolLiveState } from '@/chat/state'
import { useChat } from '@/chat/store'
import { thinkingSummary } from '@/lib/format'
import type { AgentMessage, AssistantMessage } from '@shared/protocol'
import { ActivityRow } from './ActivityRow'
import { MarkdownBody } from './MarkdownBody'
import { PiIcon } from './PiIcon'
import { ToolCard } from './ToolCard'

export function Transcript({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  const messages = useChat((state) => state.messages)
  const toolLive = useChat((state) => state.toolLive)
  const isStreaming = useChat((state) => state.isStreaming)
  const stickToBottom = useRef(true)
  const hasMessages = messages.length > 0

  useEffect(() => {
    const node = scrollerRef.current
    if (!node || !stickToBottom.current) return
    node.scrollTop = node.scrollHeight
  }, [messages, toolLive, isStreaming, scrollerRef])

  return (
    <div
      ref={scrollerRef}
      className="min-h-0 flex-1 scroll-fade overflow-y-auto px-6"
      onScroll={(event) => {
        const node = event.currentTarget
        stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80
      }}
    >
      {!hasMessages ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center select-none">
          <PiIcon className="size-10 text-neutral-400 dark:text-neutral-600" />
          <p className="mt-3 text-xs text-muted-foreground">Send pi a prompt.</p>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col pt-12 pb-10">
          {messages.map((message, index) => (
            <MessageRow
              key={messageKey(message, index)}
              message={message}
              toolLive={toolLive}
              streaming={isStreaming && index === lastAssistantIndex(messages)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function messageKey(message: AgentMessage, fallback: number): string {
  if (message.role === 'toolResult') {
    return `toolResult-${message.toolCallId}`
  }
  if (typeof message.timestamp === 'number') {
    return `${message.role}-${message.timestamp}`
  }
  return `${message.role}-${fallback}`
}

function lastAssistantIndex(messages: AgentMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'assistant') return i
  }
  return -1
}

const MessageRow = memo(function MessageRow({
  message,
  toolLive,
  streaming,
}: {
  message: AgentMessage
  toolLive: Record<string, ToolLiveState>
  streaming: boolean
}) {
  if (message.role === 'user') {
    return (
      <div className="my-4 flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-border/70 bg-card/90 px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-foreground shadow-xs select-text dark:bg-muted/60">
          {userText(message)}
        </div>
      </div>
    )
  }

  if (message.role === 'assistant') {
    return <AssistantRow message={message} toolLive={toolLive} streaming={streaming} />
  }

  if (message.role === 'toolResult') {
    return null
  }

  if (message.role === 'compactionSummary') {
    return (
      <div className="my-2 flex items-center justify-center gap-2">
        <div className="h-px flex-1 bg-border/50" />
        <span className="rounded-full border border-border/50 bg-muted/50 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
          Context compacted
        </span>
        <div className="h-px flex-1 bg-border/50" />
      </div>
    )
  }

  return null
})

function AssistantRow({
  message,
  toolLive,
  streaming,
}: {
  message: AssistantMessage
  toolLive: Record<string, ToolLiveState>
  streaming: boolean
}) {
  const lastTextIndex = message.content.reduce(
    (last, block, index) => (block.type === 'text' ? index : last),
    -1,
  )

  return (
    <div className="flex flex-col select-text">
      {message.content.map((block, contentIndex) => {
        if (block.type === 'thinking') {
          const thinking = block.thinking
          if (!thinking?.trim()) return null
          const inProgress = streaming && contentIndex === message.content.length - 1
          return (
            <ActivityRow
              key={`thinking-${message.timestamp}-${contentIndex}`}
              icon={Brain}
              label={inProgress ? 'Thinking' : 'Thought'}
              summary={thinkingSummary(thinking)}
            >
              <div className="max-h-80 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {thinking}
              </div>
            </ActivityRow>
          )
        }
        if (block.type === 'text') {
          const text = block.text
          if (!text?.trim()) return null
          const key = `text-${message.timestamp}-${contentIndex}`
          if (streaming && contentIndex === lastTextIndex) {
            return (
              <div key={key} className="py-1.5 text-[14px] leading-relaxed whitespace-pre-wrap">
                {text}
                <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse rounded-xs bg-foreground/70 align-middle" />
              </div>
            )
          }
          return (
            <div key={key} className="py-1.5">
              <MarkdownBody text={text} />
            </div>
          )
        }
        if (block.type === 'toolCall') {
          return (
            <ToolCard
              key={block.id}
              name={block.name}
              args={block.arguments}
              live={toolLive[block.id]}
            />
          )
        }
        return null
      })}
      {message.errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {message.errorMessage}
        </div>
      ) : null}
    </div>
  )
}
