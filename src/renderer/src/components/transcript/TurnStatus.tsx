import { useEffect, useState } from 'react'
import { formatElapsed } from '@/lib/format'
import { Spinner } from '@/components/ui/spinner'

export function TurnStatus({
  kind,
  startedAt,
  endedAt,
}: {
  kind: 'waiting' | 'working' | 'worked'
  startedAt: number
  endedAt: number | null
}) {
  const live = endedAt == null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [live, startedAt])

  const elapsed = (endedAt ?? now) - startedAt
  if (!live && elapsed < 1000) return null
  const clock = formatElapsed(elapsed)
  const label =
    kind === 'waiting'
      ? `Waiting for response … ${clock}`
      : kind === 'working'
        ? `Working … ${clock}`
        : `Worked for ${clock}`

  return (
    <div className="mt-1 mb-3 flex items-center gap-2 text-muted-foreground select-none">
      {live ? (
        <span className="flex size-4 shrink-0 items-center justify-center">
          <Spinner className="size-3.5" />
        </span>
      ) : null}
      <span className={live ? 'shimmer' : undefined}>{label}</span>
    </div>
  )
}
