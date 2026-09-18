import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { useChat } from '@/chat/store'
import { useSession } from '@/session/store'
import { Button } from '@/components/ui/button'
import { Composer } from './Composer'
import { SessionSwitcher } from './SessionSwitcher'
import { Transcript } from './Transcript'

export function ChatPage() {
  const cwd = useSession((state) => state.cwd)
  const connection = useSession((state) => state.connection)
  const error = useSession((state) => state.error)
  const openCwd = useSession((state) => state.openCwd)
  const leave = useSession((state) => state.leave)
  const newSession = useSession((state) => state.newSession)
  const chat = useChat()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const canCreate = connection === 'ready' && (chat.isStreaming || chat.messages.length > 0)

  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      {/* Overlay: keep macOS traffic-light drag space without pushing transcript down */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-9 items-center select-none">
        <div
          className="app-drag pointer-events-auto h-full min-w-0 flex-1"
          onWheel={(event) => {
            scrollerRef.current?.scrollBy({ top: event.deltaY })
          }}
        />
        <div className="app-no-drag pointer-events-auto mr-2.5 flex items-center">
          <SessionSwitcher />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="app-no-drag text-muted-foreground"
            aria-label="New session"
            title="New session"
            disabled={!canCreate}
            onClick={() => void newSession()}
          >
            <Plus />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="app-no-drag mx-4 mt-9 mb-2 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs text-destructive shadow-sm">
          <p className="min-w-0 flex-1 truncate">{error}</p>
          <div className="flex shrink-0 items-center gap-2.5">
            {cwd && connection === 'error' ? (
              <button
                type="button"
                className="font-medium underline underline-offset-2 hover:opacity-80"
                onClick={() => void openCwd(cwd)}
              >
                Reconnect
              </button>
            ) : null}
            <button
              type="button"
              className="font-medium underline underline-offset-2 hover:opacity-80"
              onClick={() => void leave()}
            >
              Change folder
            </button>
          </div>
        </div>
      ) : null}

      <Transcript scrollerRef={scrollerRef} model={chat} />
      <Composer />
    </div>
  )
}
