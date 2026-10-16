import { memo } from 'react'
import type { ToolLiveState } from '@/chat/state'
import type { AgentMessage, ToolResultMessage } from '@shared/protocol'
import { AssistantRow } from './message/AssistantRow'
import { DividerRow } from './message/DividerRow'
import { UserRow } from './message/UserRow'

export const MessageRow = memo(function MessageRow({
  message,
  toolLive,
  toolResults,
  streaming,
  isLive = false,
}: {
  message: AgentMessage
  toolLive: Record<string, ToolLiveState>
  toolResults: Record<string, ToolResultMessage>
  streaming: boolean
  isLive?: boolean
}) {
  switch (message.role) {
    case 'user':
      return <UserRow message={message} />

    case 'assistant':
      return (
        <AssistantRow
          message={message}
          toolLive={toolLive}
          toolResults={toolResults}
          streaming={streaming}
          isLive={isLive}
        />
      )

    case 'compactionSummary':
      return <DividerRow label="Context Compacted" />

    case 'toolResult':
      return null

    case 'custom':
      return <DividerRow label="Loop prompt changed" />

    default:
      return null
  }
})
