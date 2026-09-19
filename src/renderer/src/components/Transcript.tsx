import { Fragment, memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Brain, CircleStop } from 'lucide-react'
import { userText, type ChatState, type ToolLiveState } from '@/chat/state'
import { FileChip } from '@/components/composer/FileChip'
import { SkillChip } from '@/components/composer/SkillChip'
import { fileChipLabel } from '@/lib/file-token'
import { keyedUserSegments } from '@/lib/user-message'
import { Spinner } from '@/components/ui/spinner'
import { formatElapsed } from '@/lib/format'
import type { AgentMessage, AssistantMessage, ToolResultMessage } from '@shared/protocol'
import { estimateTurnMs, userTurns } from '@shared/turns'
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@/components/ui/scroll-area'
import { ActivityRow } from './ActivityRow'
import { MarkdownBody } from './MarkdownBody'
import { PiIcon } from './PiIcon'
import { ToolCard } from './ToolCard'

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
  } = model
  const stickToBottom = useRef(follow)
  const hasMessages = messages.length > 0
  const turns = userTurns(messages)
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
        className="px-6"
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
                streaming={assistantStreaming && index === lastAssistantIndex(messages)}
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
                        streaming={assistantStreaming && index === lastAssistantIndex(messages)}
                      />
                    )
                  })}
                  {status ? <TurnStatus key={`status-${turn.start}`} {...status} /> : null}
                </Fragment>
              )
            })}
            {isStreaming && turns.length === 0 && turnStartedAt != null ? (
              <TurnStatus kind="waiting" startedAt={turnStartedAt} endedAt={null} />
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
  messages,
  persistedAt,
  turn,
}: {
  isLast: boolean
  isStreaming: boolean
  turnActive: boolean
  turnStartedAt: number | null
  turnEndedAt: number | null
  messages: AgentMessage[]
  persistedAt: number[]
  turn: { start: number; end: number }
}): { kind: 'waiting' | 'working' | 'worked'; startedAt: number; endedAt: number | null } | null {
  if (isStreaming && isLast && turnStartedAt != null) {
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

function TurnStatus({
  kind,
  startedAt,
  endedAt,
}: {
  kind: 'waiting' | 'working' | 'worked'
  startedAt: number
  endedAt: number | null
}) {
  const live = endedAt == null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [live, startedAt])

  const elapsed = (endedAt ?? now) - startedAt
  if (!live && elapsed < 1000) return null
  const clock = formatElapsed(elapsed)
  const label =
    kind === 'waiting'
      ? `Waiting for response … ${clock}`
      : kind === 'working'
        ? `Working … ${clock}`
        : `Worked for ${clock}`

  return (
    <div className="mt-1 mb-3 flex items-center gap-2 text-muted-foreground select-none">
      {live ? (
        <span className="flex size-4 shrink-0 items-center justify-center">
          <Spinner className="size-3.5" />
        </span>
      ) : null}
      <span className={live ? 'shimmer' : undefined}>{label}</span>
    </div>
  )
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
  toolResults,
  streaming,
}: {
  message: AgentMessage
  toolLive: Record<string, ToolLiveState>
  toolResults: Record<string, ToolResultMessage>
  streaming: boolean
}) {
  if (message.role === 'user') {
    const segments = keyedUserSegments(userText(message))
    return (
      <div className="my-4 flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-border/70 bg-card/90 px-4 py-2.5 leading-relaxed whitespace-pre-wrap text-foreground shadow-xs select-text dark:bg-muted/60">
          {segments.map((segment) =>
            segment.type === 'skill' ? (
              <SkillChip key={segment.key} name={segment.name} />
            ) : segment.type === 'file' ? (
              <FileChip
                key={segment.key}
                label={fileChipLabel(segment.path, segment.range)}
                title={segment.path}
                directory={segment.path.endsWith('/')}
              />
            ) : (
              <span key={segment.key}>{segment.text}</span>
            ),
          )}
        </div>
      </div>
    )
  }

  if (message.role === 'assistant') {
    return (
      <AssistantRow
        message={message}
        toolLive={toolLive}
        toolResults={toolResults}
        streaming={streaming}
      />
    )
  }

  if (message.role === 'toolResult') {
    return null
  }

  if (message.role === 'compactionSummary') {
    return (
      <div className="my-2 flex items-center justify-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="rounded-full px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
          Context Compacted
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    )
  }

  return null
})

function AssistantRow({
  message,
  toolLive,
  toolResults,
  streaming,
}: {
  message: AssistantMessage
  toolLive: Record<string, ToolLiveState>
  toolResults: Record<string, ToolResultMessage>
  streaming: boolean
}) {
  return (
    <div className="flex flex-col select-text">
      {message.content.map((block, contentIndex) => {
        if (block.type === 'thinking') {
          const thinking = block.thinking
          const inProgress = streaming && contentIndex === message.content.length - 1
          if (!thinking?.trim() && !inProgress) return null
          return (
            <ThinkingRow
              key={`thinking-${message.timestamp}-${contentIndex}`}
              thinking={thinking}
              inProgress={inProgress}
            />
          )
        }
        if (block.type === 'text') {
          const text = block.text
          if (!text?.trim()) return null
          return (
            <div key={`text-${message.timestamp}-${contentIndex}`} className="py-1.5">
              <MarkdownBody
                text={text}
                streaming={streaming && contentIndex === message.content.length - 1}
              />
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
              result={toolResults[block.id]}
              pending={streaming && contentIndex === message.content.length - 1}
            />
          )
        }
        return null
      })}
      {message.errorMessage ? (
        <ActivityRow icon={CircleStop} label={message.errorMessage} summary="" />
      ) : null}
    </div>
  )
}

function ThinkingRow({ thinking, inProgress }: { thinking: string; inProgress: boolean }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [override, setOverride] = useState<{ inProgress: boolean; open: boolean } | null>(null)
  const open = override?.inProgress === inProgress ? override.open : inProgress

  useEffect(() => {
    if (!inProgress || !open) return
    const node = bodyRef.current
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [inProgress, open, thinking])

  return (
    <ActivityRow
      icon={Brain}
      label={inProgress ? 'Thinking' : 'Thought'}
      summary=""
      running={inProgress}
      open={open}
      onOpenChange={(next) => setOverride({ inProgress, open: next })}
    >
      {thinking.trim() ? (
        <div
          ref={bodyRef}
          className="max-h-80 scroll-fade overflow-auto scroll-smooth text-muted-foreground"
        >
          <MarkdownBody text={thinking} streaming={inProgress} />
        </div>
      ) : null}
    </ActivityRow>
  )
}
