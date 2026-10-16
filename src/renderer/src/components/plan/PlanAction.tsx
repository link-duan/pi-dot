import { ListChecks } from 'lucide-react'
import { planCard } from '@/session/state'
import { ActionPill } from '@/components/composer/ActionPill'
import { useSession } from '@/session/store'
import { usePlan } from './usePlan'

/** A built plan, or one being revised, stays viewable read-only from the Composer's action bar. */
export function PlanAction() {
  const viewable = useSession((state) => planCard(state) === 'view')
  const openPlanViewer = useSession((state) => state.openPlanViewer)
  const { name } = usePlan()
  if (!viewable) return null
  return (
    <ActionPill
      icon={ListChecks}
      label={name}
      title={`View plan: ${name}`}
      onClick={openPlanViewer}
    />
  )
}
