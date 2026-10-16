import { formatTokenCount } from '@/lib/format'
import { useSession } from '@/session/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'

const SIZE = 16
const STROKE = 1.5

export function ContextUsageRing() {
  const usage = useSession((state) => state.contextUsage)
  const running = useSession((state) =>
    state.sessionFile ? state.running.includes(state.sessionFile) : false,
  )
  const compact = useSession((state) => state.compact)
  if (!usage) return null

  const tokens = usage.tokens
  const percent = usage.percent
  const known = tokens != null && percent != null
  const rounded = known ? Math.round(percent) : null
  const high = rounded != null && rounded > 90
  const radius = (SIZE - STROKE) / 2
  const circumference = 2 * Math.PI * radius
  const dash = circumference * (known ? Math.min(1, Math.max(0, percent / 100)) : 0)
  const windowLabel = formatTokenCount(usage.contextWindow)
  const usedLabel = tokens == null ? '?' : formatTokenCount(tokens)
  const leftLabel =
    tokens == null ? '?' : formatTokenCount(Math.max(0, usage.contextWindow - tokens))
  const title = known ? `${rounded}% context used` : 'Context used unknown'
  const { session, compacting } = usage

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${title}, ${usedLabel} of ${windowLabel} tokens`}
          />
        }
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-4 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            fill="none"
            className="stroke-border"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            fill="none"
            className={high ? 'stroke-destructive' : 'stroke-muted-foreground'}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
        </svg>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-60 gap-0 p-0 text-xs">
        <section className="flex flex-col gap-2 p-3">
          <Row label="Context" value={known ? `${rounded}%` : '—'} heading />
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', high ? 'bg-destructive' : 'bg-primary')}
              style={{ width: `${known ? Math.min(100, Math.max(0, percent)) : 0}%` }}
            />
          </div>
          <Row label={`${usedLabel} / ${windowLabel}`} value={`${leftLabel} left`} />
        </section>
        <div className="mx-3 h-px bg-border/50" />
        <section className="flex flex-col gap-1.5 p-3">
          <Row label="Session" heading />
          <Row label="Input" value={formatTokenCount(session.input)} />
          <Row label="Output" value={formatTokenCount(session.output)} />
          <Row label="Cache read" value={formatTokenCount(session.cacheRead)} />
          <Row label="Cache write" value={formatTokenCount(session.cacheWrite)} />
          <Row label="Cost" value={`$${session.cost.toFixed(2)}`} />
        </section>
        <div className="mx-3 h-px bg-border/50" />
        <div className="p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={compacting || running}
            onClick={() => void compact()}
          >
            {compacting ? (
              <>
                <Spinner className="size-3.5" />
                Compacting…
              </>
            ) : (
              'Compact now'
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Row({ label, value, heading }: { label: string; value?: string; heading?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={heading ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
      {value && <span className="font-medium tabular-nums">{value}</span>}
    </div>
  )
}
