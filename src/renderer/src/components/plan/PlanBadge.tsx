import { ListChecks, X } from 'lucide-react'
import { useChat } from '@/session/store'

export function PlanBadge({ onExit }: { onExit: () => void }) {
  const isStreaming = useChat((state) => state.isStreaming)
  return (
    <span
      className="inline-flex h-6 shrink-0 items-center gap-1 rounded-[calc(var(--radius-2xl)-7px)] bg-plan/10 pr-0.5 pl-1.5 text-xs font-medium text-plan first:-ml-0.5"
      title={`Plan mode · Shift+Tab to exit${isStreaming ? ' · applies to the next message' : ''}`}
    >
      <ListChecks className="size-3" />
      Plan
      <button
        type="button"
        aria-label="Exit plan mode"
        onClick={onExit}
        className="flex size-4 cursor-pointer items-center justify-center rounded-sm hover:bg-plan/15"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}
