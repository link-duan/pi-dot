import { Fragment, useImperativeHandle, useMemo, useRef, type Ref, type RefObject } from 'react'
import type { ChatState, RetryState } from '@/chat/state'
import type { AgentMessage, ToolResultMessage } from '@shared/protocol'
import { estimateTurnMs, userTurns } from '@shared/turns'
import { useNavigate } from 'react-router'
import { PiIcon } from '@/components/PiIcon'
import { Button } from '@/components/ui/button'
import { PATH } from '@/router'
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@/components/ui/scroll-area'
import { MessageRow } from './MessageRow'
import { ScrollToBottomButton } from './ScrollToBottomButton'
import { ExtensionLineRow } from './message/ExtensionLineRow'
import { SteeringRow } from './message/SteeringRow'
import { TurnActions } from './TurnActions'
import { TurnStatus } from './TurnStatus'
import { useStickyToBottom } from './useStickyToBottom'
import { useSession } from '@/session/store'

export interface TranscriptHandle {
  scrollToBottom: () => void
}

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
  | 'steeringQueue'
  | 'extensionLines'
>

export function Transcript({
  ref,
  scrollerRef,
  model,
  follow = true,
}: {
  ref?: Ref<TranscriptHandle | null>
  scrollerRef: RefObject<HTMLDivElement | null>
  model: TranscriptModel
  follow?: boolean
}) {
  const removeSteering = useSession((state) => state.removeSteering)
  const noModels = useSession((state) => state.connection === 'ready' && state.models.length === 0)
  const navigate = useNavigate()
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
    steeringQueue = [],
    extensionLines,
  } = model
  const contentRef = useRef<HTMLDivElement>(null)
  const { showScrollBottom, scrollToBottom, onScroll, onWheel } = useStickyToBottom({
    viewportRef: scrollerRef,
    contentRef,
    initialFollow: follow,
  })

  useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom])

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
  // Extension lines added after message `at - 1`; they only append or replace the last one.
  const extensionRows = (at: number) =>
    extensionLines.map((line, index) =>
      line.at === at ? <ExtensionLineRow key={index} line={line} /> : null,
    )

  return (
    <ScrollArea className="min-h-0 flex-1">
      <ScrollAreaViewport
        ref={scrollerRef}
        className="overscroll-contain px-6"
        onWheel={onWheel}
        onScroll={onScroll}
      >
        <div ref={contentRef} className="flex min-h-full flex-col">
          {!hasMessages && !isStreaming && extensionLines.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-12 text-center select-none">
              <PiIcon className="size-10 text-neutral-400 dark:text-neutral-600" />
              {noModels ? (
                <>
                  <p className="mt-3 text-sm font-medium text-foreground">
                    Connect a model provider
                  </p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                    Sign in with a subscription or add an API key to start chatting. Your existing
                    ~/.pi/agent login is picked up automatically.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-4"
                    onClick={() => navigate(`${PATH.settings}?section=providers`)}
                  >
                    Open Providers
                  </Button>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Send pi a prompt.</p>
              )}
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col pt-12 pb-10">
              {extensionRows(0)}
              {messages.slice(0, turns[0]?.start ?? messages.length).map((message, index) => (
                <Fragment key={messageKey(message, index)}>
                  <MessageRow
                    message={message}
                    toolLive={toolLive}
                    toolResults={toolResults}
                    streaming={index === streamingIndex}
                  />
                  {extensionRows(index + 1)}
                </Fragment>
              ))}
              {turns.map((turn, turnIndex) => {
                const isLast = turnIndex === turns.length - 1
                const isTurnLive = isLast && (isStreaming || turnActive)
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
                    <div className="group/turn flex flex-col">
                      {messages.slice(turn.start, turn.end + 1).map((message, offset) => {
                        const index = turn.start + offset
                        return (
                          <Fragment key={messageKey(message, index)}>
                            <MessageRow
                              message={message}
                              toolLive={toolLive}
                              toolResults={toolResults}
                              streaming={index === streamingIndex}
                              isLive={isTurnLive}
                            />
                            {/* Lines after the turn's last message go below the whole turn. */}
                            {index === turn.end ? null : extensionRows(index + 1)}
                          </Fragment>
                        )
                      })}
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {status ? <TurnStatus {...status} /> : null}
                        </div>
                        {isLast && isStreaming ? null : (
                          <TurnActions
                            messages={messages.slice(turn.start, turn.end + 1)}
                            canRetry={isLast && !isStreaming}
                          />
                        )}
                      </div>
                    </div>
                    {extensionRows(turn.end + 1)}
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
              {steeringQueue.map((text, i) => (
                <SteeringRow
                  key={`steering-${i}-${text}`}
                  text={text}
                  onCancel={() =>
                    void removeSteering(i).catch((error: unknown) => {
                      console.error('Failed to cancel steering', error)
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
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
      <ScrollToBottomButton visible={showScrollBottom} onClick={scrollToBottom} />
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
