import { ChevronDown, Repeat, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatInterval } from '@shared/protocol'
import { useChat, useSession } from '@/session/store'

/** Interval choices; Auto (null) lets the model pace the loop. */
const INTERVALS = [null, 60_000, 300_000, 900_000, 1_800_000, 3_600_000].map((ms) => ({
  ms,
  label: ms === null ? 'Auto' : formatInterval(ms),
}))

const BADGE =
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-[calc(var(--radius-2xl)-7px)] bg-loop/10 pr-0.5 pl-1.5 text-xs font-medium text-loop first:-ml-0.5'

/**
 * The Loop toggle in the Composer footer: the next message starts a loop at the chosen interval,
 * or changes the running loop's prompt.
 */
export function LoopBadge({ onExit }: { onExit: () => void }) {
  const draft = useChat((chat) => chat.loopDraft)
  const setLoopDraft = useSession((state) => state.setLoopDraft)
  if (!draft) return null
  if (draft.kind === 'edit') {
    return (
      <span className={BADGE}>
        <Repeat className="size-3" />
        Editing loop
        <ExitButton onExit={onExit} />
      </span>
    )
  }
  const current = INTERVALS.find((interval) => interval.ms === draft.ms) ?? INTERVALS[0]!
  return (
    <span
      className={BADGE}
      title={
        draft.ms === null
          ? 'Loop · the next message repeats, paced by the model'
          : `Loop · the next message repeats every ${current.label}`
      }
    >
      <Repeat className="size-3" />
      Loop
      <DropdownMenu>
        <DropdownMenuTrigger
          variant="ghost"
          aria-label="Loop interval"
          className="h-5 gap-0.5 rounded-sm p-0 px-1 text-xs font-medium text-loop/80 hover:bg-loop/15 hover:text-loop aria-expanded:bg-loop/15"
        >
          {current.label}
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" className="min-w-36 p-1 text-xs" sideOffset={6}>
          <DropdownMenuRadioGroup
            value={current.label}
            onValueChange={(label) => {
              const next = INTERVALS.find((interval) => interval.label === label)
              if (next) setLoopDraft({ kind: 'start', ms: next.ms })
            }}
          >
            {INTERVALS.map((interval) => (
              <DropdownMenuRadioItem
                key={interval.label}
                value={interval.label}
                className="py-1 pl-2 text-xs leading-4"
              >
                {interval.ms === null ? (
                  <span>
                    Auto <span className="text-muted-foreground">· model paces</span>
                  </span>
                ) : (
                  `Every ${interval.label}`
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ExitButton onExit={onExit} />
    </span>
  )
}

function ExitButton({ onExit }: { onExit: () => void }) {
  return (
    <button
      type="button"
      aria-label="Exit loop"
      onClick={onExit}
      className="flex size-4 cursor-pointer items-center justify-center rounded-sm hover:bg-loop/15"
    >
      <X className="size-3" />
    </button>
  )
}
