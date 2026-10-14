import { memo, useMemo } from 'react'
import { GitBranch, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { userText } from '@/chat/state'
import { FileChip } from '@/components/composer/FileChip'
import { SkillChip } from '@/components/composer/SkillChip'
import { fileChipLabel } from '@/lib/file-token'
import { formatMessageTime } from '@/lib/format'
import { keyedUserSegments } from '@/lib/user-message'
import { useChat, useSession } from '@/session/store'
import type { UserMessage } from '@shared/protocol'
import { CopyAction, MessageAction } from '../MessageActions'
import { UserBubble } from './UserBubble'

export const UserRow = memo(function UserRow({ message }: { message: UserMessage }) {
  const segments = useMemo(() => keyedUserSegments(userText(message)), [message])
  const sentAt = useMemo(() => formatMessageTime(message.timestamp), [message.timestamp])
  const busy = useChat((chat) => chat.isStreaming)
  const editMessage = useSession((state) => state.editMessage)
  const forkMessage = useSession((state) => state.forkMessage)
  const idleOnly = 'Available when the run ends'

  return (
    <UserBubble
      footer={
        <div className="mt-0.5 flex items-center gap-0.5">
          <div className="flex items-center opacity-0 transition-opacity duration-150 group-hover/user:opacity-100 focus-within:opacity-100">
            <CopyAction text={() => userText(message)} />
            <MessageAction
              icon={Pencil}
              label={busy ? idleOnly : 'Edit and resend'}
              disabled={busy}
              onClick={() => void editMessage(message.timestamp)}
            />
            <MessageAction
              icon={GitBranch}
              label={busy ? idleOnly : 'Fork into a new session'}
              disabled={busy}
              onClick={() =>
                void forkMessage({ role: 'user', timestamp: message.timestamp }).then((forked) => {
                  if (forked) toast('Forked into a new session')
                })
              }
            />
          </div>
          {sentAt ? (
            <time
              dateTime={new Date(message.timestamp).toISOString()}
              className="px-1 text-xs text-muted-foreground tabular-nums"
            >
              {sentAt}
            </time>
          ) : null}
        </div>
      }
    >
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
    </UserBubble>
  )
})
