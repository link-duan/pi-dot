import { Server } from 'lucide-react'
import { useNavigate } from 'react-router'
import { PATH } from '@/router'
import { useChat, useSession } from '@/session/store'
import { ActionPill } from './ActionPill'
import { PlanAction } from '@/components/plan/PlanAction'

/**
 * Pills above the Composer. Each action renders itself or nothing; with none, the bar is empty
 * and takes no space. Add new actions (e.g. Commit, Push) here.
 */
export function ComposerActions() {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 empty:hidden">
      <NoModelsAction />
      <PlanAction />
    </div>
  )
}

/** In a conversation whose models went away; an empty one shows the Transcript's prompt. */
function NoModelsAction() {
  const navigate = useNavigate()
  const noModels = useSession((state) => state.connection === 'ready' && state.models.length === 0)
  const hasMessages = useChat((chat) => chat.messages.length > 0)
  if (!noModels || !hasMessages) return null
  return (
    <ActionPill
      icon={Server}
      label="No models · Open Providers"
      onClick={() => navigate(`${PATH.settings}?section=providers`)}
    />
  )
}
