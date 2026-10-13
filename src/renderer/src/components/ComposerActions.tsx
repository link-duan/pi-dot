import { Pencil } from 'lucide-react'
import { useSession } from '@/session/store'
import { ActionPill } from './ActionPill'
import { PlanAction } from './PlanReview'

/**
 * Pills above the Composer. Each action renders itself or nothing; with none, the bar is empty
 * and takes no space. Add new actions (e.g. Commit, Push) here.
 */
export function ComposerActions() {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 empty:hidden">
      <EditingAction />
      <PlanAction />
    </div>
  )
}

function EditingAction() {
  const editing = useSession((state) => state.editing?.sessionFile === state.sessionFile)
  const cancelEdit = useSession((state) => state.cancelEdit)
  if (!editing) return null
  return (
    <ActionPill
      icon={Pencil}
      label="Editing message · Esc to cancel"
      title="Cancel the edit and return to the conversation"
      onClick={() => void cancelEdit()}
    />
  )
}
