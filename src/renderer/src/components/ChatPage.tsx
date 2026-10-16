import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { Navigate } from 'react-router'
import { PATH } from '@/router'
import { useChat, useSession } from '@/session/store'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Composer } from '@/components/composer/Composer'
import { PlanViewer } from '@/components/plan/PlanViewer'
import { SessionSwitcher } from '@/components/pickers/SessionSwitcher'
import { Transcript, type TranscriptHandle } from './transcript/Transcript'

export function ChatPage() {
  const cwd = useSession((state) => state.cwd)
  const connection = useSession((state) => state.connection)
  const error = useSession((state) => state.error)
  const openCwd = useSession((state) => state.openCwd)
  const leave = useSession((state) => state.leave)
  const newSession = useSession((state) => state.newSession)
  const chat = useChat()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<TranscriptHandle>(null)
  const canCreate = connection === 'ready' && (chat.isStreaming || chat.messages.length > 0)

  // Without a bound folder (left it, or a reload found no live agent) there is no session to show.
  if (!cwd) return <Navigate to={PATH.launcher} replace />

  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      {/* Overlay: keep macOS traffic-light drag space without pushing transcript down */}
      {/* The title sits centered; everything but its buttons drags the window. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 grid h-11 grid-cols-[1fr_auto_1fr] items-start bg-linear-to-b from-background from-60% to-transparent select-none"
        onWheel={(event) => {
          // React bubbles wheel events out of portals (the session list); only the bar itself scrolls the transcript.
          if (!event.currentTarget.contains(event.target as Node)) return
          scrollerRef.current?.scrollBy({ top: event.deltaY })
        }}
      >
        <div className="app-drag pointer-events-auto h-9" />
        <div className="app-drag pointer-events-auto flex h-9 max-w-[min(40rem,60vw)] min-w-0 items-center">
          <SessionSwitcher cwd={cwd} />
        </div>
        <div className="app-drag pointer-events-auto flex h-9 items-center justify-end pr-2.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="app-no-drag text-muted-foreground"
                  aria-label="New session"
                  disabled={!canCreate}
                  onClick={() => {
                    void newSession().then(() => useSession.getState().requestComposerFocus())
                  }}
                />
              }
            >
              <Plus />
            </TooltipTrigger>
            <TooltipContent>
              New session
              <KbdGroup>
                <Kbd>Cmd</Kbd>
                <Kbd>N</Kbd>
              </KbdGroup>
            </TooltipContent>
          </Tooltip>
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

      <Transcript ref={transcriptRef} scrollerRef={scrollerRef} model={chat} />
      <Composer onSend={() => transcriptRef.current?.scrollToBottom()} />
      <PlanViewer />
    </div>
  )
}
