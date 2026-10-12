import { PlanAction } from './PlanReview'

/**
 * Pills above the Composer. Each action renders itself or nothing; with none, the bar is empty
 * and takes no space. Add new actions (e.g. Commit, Push) here.
 */
export function ComposerActions() {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 empty:hidden">
      <PlanAction />
    </div>
  )
}
