import { Fragment, useEffect, useMemo, useRef, type RefObject } from 'react'
import type { ChatState, RetryState } from '@/chat/state'
import type { AgentMessage, ToolResultMessage } from '@shared/protocol'
import { estimateTurnMs, userTurns } from '@shared/turns'
import { PiIcon } from '@/components/PiIcon'
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@/components/ui/scroll-area'
import { MessageRow } from './MessageRow'
import { TurnStatus } from './TurnStatus'

export type TranscriptModel = Pick<
  ChatState,
  | 'messages'
  | 'persistedAt'
  | 'toolLive'
  | 'isStreaming'
  | 'assistantStreaming'
  | 'turnActive'
  | 'turnStartedAt'
  | 'turnEndedAt'
  | 'retry'
>

export function Transcript({
  scrollerRef,
  model,
  follow = true,
}: {
  scrollerRef: RefObject<HTMLDivElement | null>
  model: TranscriptModel
  follow?: boolean
}) {
  const {
    messages,
    persistedAt,
    toolLive,
    isStreaming,
    assistantStreaming,
    turnActive,
    turnStartedAt,
    turnEndedAt,
    retry,
  } = model
  const stickToBottom = useRef(follow)
  const hasMessages = messages.length > 0
  const turns = userTurns(messages)
  const streamingIndex = assistantStreaming ? lastAssistantIndex(messages) : -1
  const toolResults = useMemo(() => {
    const map: Record<string, ToolResultMessage> = {}
    for (const message of messages) {
      if (message.role === 'toolResult') map[message.toolCallId] = message
    }
    return map
  }, [messages])

  useEffect(() => {
    const node = scrollerRef.current
    if (!node || !stickToBottom.current) return
    node.scrollTop = node.scrollHeight
  }, [messages, toolLive, isStreaming, scrollerRef])

  return (
    <ScrollArea className="min-h-0 flex-1">
      <ScrollAreaViewport
        ref={scrollerRef}
        className="overscroll-contain px-6"
        onScroll={(event) => {
          const node = event.currentTarget
          stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80
        }}
      >
        {!hasMessages && !isStreaming ? (
          <div className="flex h-full flex-col items-center justify-center py-12 text-center select-none">
            <PiIcon className="size-10 text-neutral-400 dark:text-neutral-600" />
            <p className="mt-3 text-sm text-muted-foreground">Send pi a prompt.</p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col pt-12 pb-10">
            {messages.slice(0, turns[0]?.start ?? messages.length).map((message, index) => (
              <MessageRow
                key={messageKey(message, index)}
                message={message}
                toolLive={toolLive}
                toolResults={toolResults}
                streaming={index === streamingIndex}
              />
            ))}
            {turns.map((turn, turnIndex) => {
              const isLast = turnIndex === turns.length - 1
              const status = turnStatus({
                isLast,
                isStreaming,
                turnActive,
                turnStartedAt,
                turnEndedAt,
                retry,
                messages,
                persistedAt,
                turn,
              })
              return (
                <Fragment key={turn.start}>
                  {messages.slice(turn.start, turn.end + 1).map((message, offset) => {
                    const index = turn.start + offset
                    return (
                      <MessageRow
                        key={messageKey(message, index)}
                        message={message}
                        toolLive={toolLive}
                        toolResults={toolResults}
                        streaming={index === streamingIndex}
                      />
                    )
                  })}
                  {status ? <TurnStatus key={`status-${turn.start}`} {...status} /> : null}
                </Fragment>
              )
            })}
            {isStreaming && turns.length === 0 && turnStartedAt != null ? (
              <TurnStatus
                kind={retry ? 'retrying' : 'waiting'}
                startedAt={turnStartedAt}
                endedAt={null}
                attempt={retry?.attempt}
                maxAttempts={retry?.maxAttempts}
                retryAt={retry?.retryAt}
              />
            ) : null}
          </div>
        )}
      </ScrollAreaViewport>
      <ScrollAreaScrollbar className="mt-9" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-background to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent"
      />
    </ScrollArea>
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

function turnStatus({
  isLast,
  isStreaming,
  turnActive,
  turnStartedAt,
  turnEndedAt,
  retry,
  messages,
  persistedAt,
  turn,
}: {
  isLast: boolean
  isStreaming: boolean
  turnActive: boolean
  turnStartedAt: number | null
  turnEndedAt: number | null
  retry: RetryState | null
  messages: AgentMessage[]
  persistedAt: number[]
  turn: { start: number; end: number }
}): {
  kind: 'waiting' | 'working' | 'worked' | 'retrying'
  startedAt: number
  endedAt: number | null
  attempt?: number
  maxAttempts?: number
  retryAt?: number
} | null {
  if (isStreaming && isLast && turnStartedAt != null) {
    if (retry) {
      return {
        kind: 'retrying',
        startedAt: turnStartedAt,
        endedAt: null,
        attempt: retry.attempt,
        maxAttempts: retry.maxAttempts,
        retryAt: retry.retryAt,
      }
    }
    return {
      kind: turnActive ? 'working' : 'waiting',
      startedAt: turnStartedAt,
      endedAt: null,
    }
  }
  if (isLast && turnStartedAt != null && turnEndedAt != null) {
    return { kind: 'worked', startedAt: turnStartedAt, endedAt: turnEndedAt }
  }
  const estimated = estimateTurnMs(messages, persistedAt, turn)
  if (estimated == null) return null
  return { kind: 'worked', startedAt: 0, endedAt: estimated }
}

function lastAssistantIndex(messages: AgentMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'assistant') return i
  }
  return -1
}
