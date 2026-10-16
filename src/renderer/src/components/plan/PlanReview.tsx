import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { planCard } from '@/session/state'
import { useSession } from '@/session/store'
import { BuildButton } from './BuildButton'
import { usePlan } from './usePlan'
import { buildPlan } from './build-plan'

/** Above the Composer while there is a plan to review; ⌘⏎ builds it. */
export function PlanReview() {
  const shown = useSession((state) => planCard(state) === 'review')
  const openPlanViewer = useSession((state) => state.openPlanViewer)
  const { name, overview } = usePlan()

  useEffect(() => {
    if (!shown) return
    // Capture phase, so the Composer's own Enter handling never sees it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !event.metaKey || event.isComposing) return
      // Typing a comment on the plan is not a Build.
      if ((event.target as Element | null)?.closest?.('[data-plan-comment]')) return
      event.preventDefault()
      event.stopPropagation()
      buildPlan()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [shown])

  if (!shown) return null

  return (
    // Mirrors the Composer's box: text lines up with its input, buttons with its send button.
    <div className="mb-2 w-full rounded-2xl border border-plan/40 bg-card/90 px-1.5 pt-1 pb-1 shadow-sm backdrop-blur-md dark:bg-card/90">
      <div className="px-1.5 pt-1.5">
        <div className="text-xs text-muted-foreground">Review Plan</div>
        <div className="mt-0.5 truncate text-sm font-medium text-foreground">{name}</div>
        {overview ? (
          <p className="mt-0.5 line-clamp-2 text-justify text-xs text-muted-foreground">
            {overview}
          </p>
        ) : null}
      </div>
      <div className="mt-1 flex justify-end gap-1 px-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-[calc(var(--radius-2xl)-5px)]"
          onClick={openPlanViewer}
        >
          View Plan
        </Button>
        <BuildButton className="-mr-1 rounded-[calc(var(--radius-2xl)-5px)]" />
      </div>
    </div>
  )
}
