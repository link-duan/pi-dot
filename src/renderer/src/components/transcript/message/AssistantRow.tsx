import { useState } from 'react'
import { CircleStop } from 'lucide-react'
import type { ToolLiveState } from '@/chat/state'
import type { AssistantMessage, ContentBlock, ToolResultMessage } from '@shared/protocol'
import { useSettings } from '@/settings/store'
import { cn } from '@/lib/utils'
import { ActivityRow } from '../ActivityRow'
import { MarkdownBody } from '../MarkdownBody'
import { ToolCard } from '../tool/ToolCard'
import { ThinkingRow } from './ThinkingRow'

export function AssistantRow({
  message,
  toolLive,
  toolResults,
  streaming,
  isLive = false,
}: {
  message: AssistantMessage
  toolLive: Record<string, ToolLiveState>
  toolResults: Record<string, ToolResultMessage>
  streaming: boolean
  isLive?: boolean
}) {
  const hideThinking = useSettings((state) => state.hideThinking)
  const lastIndex = message.content.length - 1

  return (
    <div className="flex flex-col select-text">
      {message.content.map((block, index) => (
        <ContentBlockView
          key={blockKey(block, message.timestamp, index)}
          block={block}
          isLatest={streaming && index === lastIndex}
          isLive={isLive}
          hideThinking={hideThinking}
          toolLive={toolLive}
          toolResults={toolResults}
        />
      ))}
      {message.errorMessage ? (
        <ActivityRow
          icon={CircleStop}
          label={
            message.stopReason === 'error' ? `Error: ${message.errorMessage}` : message.errorMessage
          }
          summary=""
          animateIn={isLive}
        />
      ) : null}
    </div>
  )
}

function blockKey(block: ContentBlock, timestamp: number, index: number): string {
  if (block.type === 'toolCall') return block.id
  return `${block.type}-${timestamp}-${index}`
}

function ContentBlockView({
  block,
  isLatest,
  isLive,
  hideThinking,
  toolLive,
  toolResults,
}: {
  block: ContentBlock
  isLatest: boolean
  isLive: boolean
  hideThinking: boolean
  toolLive: Record<string, ToolLiveState>
  toolResults: Record<string, ToolResultMessage>
}) {
  switch (block.type) {
    case 'thinking': {
      if (hideThinking) return null
      const thinking = block.thinking
      if (!thinking?.trim() && !isLatest) return null
      return <ThinkingRow thinking={thinking} inProgress={isLatest} animateIn={isLive} />
    }

    case 'text': {
      const text = block.text
      if (!text?.trim()) return null
      return <TextBlock text={text} streaming={isLatest} animateIn={isLive} />
    }

    case 'toolCall':
      return (
        <ToolCard
          name={block.name}
          args={block.arguments}
          live={toolLive[block.id]}
          result={toolResults[block.id]}
          pending={isLatest}
          animateIn={isLive}
        />
      )

    default:
      return null
  }
}

function TextBlock({
  text,
  streaming,
  animateIn,
}: {
  text: string
  streaming: boolean
  animateIn: boolean
}) {
  const [initialAnimate] = useState(() => animateIn)
  return (
    <div className={cn('py-1.5', initialAnimate && 'animate-blur-reveal')}>
      <MarkdownBody text={text} streaming={streaming} />
    </div>
  )
}
