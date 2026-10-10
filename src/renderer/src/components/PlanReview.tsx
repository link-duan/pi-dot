import { useEffect, useMemo } from 'react'
import { parsePlan } from '@shared/plan-file'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { useChat, useSession } from '@/session/store'

export function usePlan() {
  const planText = useSession((state) => state.planText)
  return useMemo(() => parsePlan(planText), [planText])
}

export function buildPlan(): void {
  const session = useSession.getState()
  session.closePlanViewer()
  void session.approvePlan().catch((error: unknown) => {
    console.error('Failed to approve plan', error)
  })
}

export function BuildButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      className={cn('bg-plan text-background hover:bg-plan/90', className)}
      onClick={buildPlan}
    >
      Build
      <Kbd className="bg-transparent px-0 text-background/60">⌘⏎</Kbd>
    </Button>
  )
}

/** Above the Composer while there is a plan to review; ⌘⏎ builds it. */
export function PlanReview() {
  const visible = useSession((state) => state.planText !== '')
  const reviewable = useChat((chat) => chat.planMode && !chat.isStreaming)
  const openPlanViewer = useSession((state) => state.openPlanViewer)
  const { name, overview } = usePlan()
  const shown = visible && reviewable

  useEffect(() => {
    if (!shown) return
    // Capture phase, so the Composer's own Enter handling never sees it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !event.metaKey || event.isComposing) return
      event.preventDefault()
      event.stopPropagation()
      buildPlan()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [shown])

  if (!shown) return null

  return (
    <div className="mb-2 w-full rounded-xl border border-plan/40 bg-card/90 p-3 shadow-sm backdrop-blur-md dark:bg-card/90">
      <div className="text-xs text-muted-foreground">Review Plan</div>
      <div className="mt-0.5 truncate text-sm font-medium text-foreground">{name}</div>
      {overview ? (
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{overview}</p>
      ) : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={openPlanViewer}>
          View Plan
        </Button>
        <BuildButton />
      </div>
    </div>
  )
}
