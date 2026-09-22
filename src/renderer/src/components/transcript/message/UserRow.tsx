import { memo, useMemo } from 'react'
import { userText } from '@/chat/state'
import { FileChip } from '@/components/composer/FileChip'
import { SkillChip } from '@/components/composer/SkillChip'
import { fileChipLabel } from '@/lib/file-token'
import { formatMessageTime } from '@/lib/format'
import { keyedUserSegments } from '@/lib/user-message'
import type { UserMessage } from '@shared/protocol'

export const UserRow = memo(function UserRow({ message }: { message: UserMessage }) {
  const segments = useMemo(() => keyedUserSegments(userText(message)), [message])
  const sentAt = useMemo(() => formatMessageTime(message.timestamp), [message.timestamp])

  return (
    <div className="mt-6 mb-2 flex justify-end first:mt-2">
      <div className="flex max-w-[min(32rem,80%)] min-w-0 flex-col items-end">
        <div className="w-fit max-w-full rounded-xl bg-foreground/4 px-3 py-2 leading-relaxed break-words whitespace-pre-wrap text-foreground select-text dark:bg-foreground/12">
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
        {sentAt ? (
          <time
            dateTime={new Date(message.timestamp).toISOString()}
            className="mt-1 px-1 text-xs text-muted-foreground tabular-nums"
          >
            {sentAt}
          </time>
        ) : null}
      </div>
    </div>
  )
})
