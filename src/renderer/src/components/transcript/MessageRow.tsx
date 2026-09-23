import { memo } from 'react'
import type { ToolLiveState } from '@/chat/state'
import type { AgentMessage, ToolResultMessage } from '@shared/protocol'
import { AssistantRow } from './message/AssistantRow'
import { CompactionRow } from './message/CompactionRow'
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
      return <CompactionRow />

    case 'toolResult':
      return null

    default:
      return null
  }
})
