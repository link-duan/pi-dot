import { Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import type { MessageRef } from '@shared/protocol'
import { useChat, useSession } from '@/session/store'
import { MessageAction } from './MessageAction'

/** Rewinds the conversation to `message`, with an Undo in the toast. */
export function RewindAction({ message }: { message: MessageRef }) {
  const busy = useChat((chat) => chat.isStreaming)
  const rewindMessage = useSession((state) => state.rewindMessage)
  return (
    <MessageAction
      icon={Undo2}
      label={busy ? 'Stop and rewind to here' : 'Rewind the conversation to here'}
      onClick={() =>
        void rewindMessage(message).then((undo) => {
          if (undo) toast('Rewound the conversation', { action: { label: 'Undo', onClick: undo } })
        })
      }
    />
  )
}
