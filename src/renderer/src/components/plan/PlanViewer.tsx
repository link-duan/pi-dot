import { useEffect, useRef, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@/components/ui/scroll-area'
import { planCard } from '@/session/state'
import { useChat, useSession } from '@/session/store'
import { PlanDocument } from './PlanComments'
import { PlanFeedbackButton } from './PlanFeedback'
import { usePlan } from './usePlan'
import { BuildButton } from './BuildButton'

/** Closing the viewer hands back to the Composer, where feedback on the plan goes. */
function backToChat(): void {
  const session = useSession.getState()
  session.closePlanViewer()
  session.requestComposerFocus()
}

/** Full-window Plan File view; opens on its own when a Plan Mode run ends. */
export function PlanViewer() {
  const open = useSession((state) => state.planViewer)
  const planPath = useChat((chat) => chat.plan?.path ?? '')
  const readOnly = useSession(planCard) !== 'review'
  const { name, overview, body } = usePlan()
  const [scrolling, setScrolling] = useState(false)
  const scrollEnd = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(scrollEnd.current), [])

  const onScroll = () => {
    setScrolling(true)
    clearTimeout(scrollEnd.current)
    scrollEnd.current = setTimeout(() => setScrolling(false), 700)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (next) return
        // Esc with focus outside an open comment popover closes the popover, not the viewer.
        const session = useSession.getState()
        if (details.reason === 'escape-key' && session.planDraft) session.setPlanDraft(null)
        else backToChat()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 ring-0 sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100"
      >
        <div className="app-drag absolute inset-x-0 top-0 z-10 h-9" />
        <ScrollArea className="flex-1">
          <ScrollAreaViewport onScroll={onScroll}>
            {/* Wide windows keep room on the right for the comment rail, which widens with them. */}
            <article className="mx-auto max-w-2xl px-6 pt-20 pb-32 [--rail:clamp(16rem,calc(16rem+(100vw-64rem)/4),22rem)] lg:max-w-[calc(44rem+var(--rail))] lg:pr-[calc(3.5rem+var(--rail))]">
              <DialogTitle className="text-[28px] leading-tight font-semibold tracking-tight">
                {name}
              </DialogTitle>
              {overview ? (
                <DialogDescription className="mt-2 text-[15px] leading-relaxed text-foreground/70">
                  {overview}
                </DialogDescription>
              ) : null}
              <div className="mt-6 mb-10 border-t border-border/60" />
              <PlanDocument body={body} readOnly={readOnly} />
            </article>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar />
        </ScrollArea>
        {/* Fades while the plan scrolls under it; back on hover or while Revise is open. */}
        <div
          data-scrolling={scrolling || undefined}
          className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-border bg-card/90 p-0.5 shadow-xl shadow-black/5 backdrop-blur-md transition-[opacity,translate] duration-200 hover:translate-y-0 hover:opacity-100 has-data-popup-open:translate-y-0 has-data-popup-open:opacity-100 data-scrolling:translate-y-1 data-scrolling:opacity-40 dark:bg-card/95 dark:shadow-black/50"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full text-muted-foreground"
            aria-label="Back to chat"
            title="Back to chat (Esc)"
            onClick={backToChat}
          >
            <X />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full text-muted-foreground"
            aria-label="Open in editor"
            title="Open in editor"
            onClick={() =>
              void window.pi.openPath(planPath).catch((error: unknown) => {
                console.error('Failed to open plan file', error)
              })
            }
          >
            <ExternalLink />
          </Button>
          {readOnly ? null : (
            <>
              <div className="mx-1 h-5 w-px bg-border" />
              <PlanFeedbackButton />
              <BuildButton size="default" className="rounded-full" />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
