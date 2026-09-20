import { formatTokenCount } from '@/lib/format'
import { useSession } from '@/session/store'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'

const SIZE = 14
const STROKE = 1.5

export function ContextUsageRing() {
  const usage = useSession((state) => state.contextUsage)
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
  const title = known ? `${rounded}% context used` : 'Context used unknown'
  const detail = `${usedLabel} / ${windowLabel} tokens`

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`${title}, ${usedLabel} of ${windowLabel} tokens`}
          />
        }
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-[14px] -rotate-90"
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
      <PopoverContent side="top" className="w-fit">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{detail}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}
