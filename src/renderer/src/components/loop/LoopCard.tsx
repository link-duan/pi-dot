import { Pencil, Repeat, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatInterval, type LoopRef } from '@shared/protocol'
import { Button } from '@/components/ui/button'
import { formatElapsed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useChat, useSession } from '@/session/store'
import { BUTTON_RADIUS, CARD } from '@/components/composer/card'

/** Above the Composer while the session runs a /loop, counting down to its next run. */
export function LoopCard({
  onEdit,
  canEdit,
}: {
  /** Loads the prompt into the Composer to change it. */
  onEdit: (prompt: string) => void
  canEdit: boolean
}) {
  const loop = useChat((chat) => chat.loop)
  if (!loop) return null
  // Keyed so each wait starts its clock fresh.
  return <LoopBody key={loop.nextAt} loop={loop} onEdit={onEdit} canEdit={canEdit} />
}

function LoopBody({
  loop,
  onEdit,
  canEdit,
}: {
  loop: NonNullable<LoopRef>
  onEdit: (prompt: string) => void
  canEdit: boolean
}) {
  const { prompt, ms, fixed, reason, nextAt } = loop
  const now = useNow(nextAt !== null)
  const left = nextAt === null ? 0 : Math.max(0, nextAt - now)

  return (
    <div className={cn(CARD, 'border-loop/40 px-1.5 pt-1 pb-1.5 select-text')}>
      <div className="flex items-center gap-2 pl-1.5">
        <Repeat className="size-3 shrink-0 text-loop" />
        <span className="text-xs font-medium text-loop">Loop</span>
        {fixed ? (
          <span className="text-xs text-muted-foreground">every {formatInterval(ms)}</span>
        ) : null}
        <span className="text-xs text-muted-foreground tabular-nums">
          {nextAt === null ? 'Running…' : `next in ${formatElapsed(left)}`}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Edit loop prompt"
            title={canEdit ? 'Edit loop prompt' : 'Cannot edit with an unsent draft'}
            disabled={!canEdit}
            className={cn(BUTTON_RADIUS, 'text-muted-foreground')}
            onClick={() => onEdit(prompt)}
          >
            <Pencil className="size-2.5" />
          </Button>
          <StopButton />
        </div>
      </div>
      <div className="flex flex-col gap-1 px-1.5 pt-0.5 pb-1">
        <p
          className="line-clamp-3 text-sm leading-5 wrap-break-word whitespace-pre-wrap text-foreground/75"
          title={prompt}
        >
          {prompt}
        </p>
        {!fixed && reason ? (
          <p className="truncate text-xs leading-4 text-muted-foreground" title={reason}>
            {reason}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** The current time, ticking each second while `active`. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

/** An X that turns red to ask once more before ending the loop, and forgets after a moment. */
function StopButton() {
  const setLoop = useSession((state) => state.setLoop)
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (!confirming) return
    const id = setTimeout(() => setConfirming(false), 3000)
    return () => clearTimeout(id)
  }, [confirming])

  return (
    <Button
      type="button"
      variant="ghost"
      size={confirming ? 'xs' : 'icon-xs'}
      aria-label={confirming ? 'Confirm stopping the loop' : 'Stop loop'}
      className={cn(
        BUTTON_RADIUS,
        // Switches to Confirm at once; a transition stretches it and fades through other colors.
        'transition-none',
        confirming
          ? 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive'
          : 'text-muted-foreground',
      )}
      onBlur={() => setConfirming(false)}
      onClick={() => {
        if (!confirming) return setConfirming(true)
        void setLoop(null).catch((error: unknown) => {
          console.error('Failed to stop loop', error)
        })
      }}
    >
      <X className="size-3.5" />
      {confirming ? 'Confirm' : null}
    </Button>
  )
}
