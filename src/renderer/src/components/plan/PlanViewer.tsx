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

  return (
    <Dialog open={open} onOpenChange={(next) => !next && backToChat()}>
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 ring-0 sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100"
      >
        <div className="app-drag absolute inset-x-0 top-0 z-10 h-9" />
        <ScrollArea className="flex-1">
          <ScrollAreaViewport>
            <article className="mx-auto max-w-2xl px-6 pt-20 pb-32 [text-autospace:normal]">
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
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-border bg-card/90 p-0.5 shadow-xl shadow-black/5 backdrop-blur-md dark:bg-card/95 dark:shadow-black/50">
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
          {readOnly ? null : <PlanFeedbackButton />}
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
          {readOnly ? null : <BuildButton size="default" className="rounded-full" />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
