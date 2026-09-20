import { memo, useEffect, useRef, useState } from 'react'
import { Brain, CircleStop } from 'lucide-react'
import { userText, type ToolLiveState } from '@/chat/state'
import { FileChip } from '@/components/composer/FileChip'
import { SkillChip } from '@/components/composer/SkillChip'
import { fileChipLabel } from '@/lib/file-token'
import { keyedUserSegments } from '@/lib/user-message'
import type { AgentMessage, AssistantMessage, ToolResultMessage } from '@shared/protocol'
import { ScrollFade } from '@/components/ui/scroll-area'
import { ActivityRow } from './ActivityRow'
import { MarkdownBody } from './MarkdownBody'
import { ToolCard } from './tool/ToolCard'

export const MessageRow = memo(function MessageRow({
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
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-border bg-card/90 px-4 py-2.5 leading-relaxed whitespace-pre-wrap text-foreground shadow-xs select-text dark:bg-muted/60">
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
        <div className="mt-2">
          <ScrollFade ref={bodyRef} className="max-h-80 scroll-smooth text-muted-foreground">
            <MarkdownBody className="space-y-3" text={thinking} streaming={inProgress} />
          </ScrollFade>
        </div>
      ) : null}
    </ActivityRow>
  )
}
