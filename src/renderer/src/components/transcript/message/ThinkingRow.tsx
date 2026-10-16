import { useEffect, useRef, useState } from 'react'
import { Brain } from 'lucide-react'
import { ScrollFade } from '@/components/ui/scroll-area'
import { formatElapsed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ActivityRow } from '../ActivityRow'
import { MarkdownBody } from '../MarkdownBody'

/**
 * The last finished line with content, stripped of markdown markers. The line still streaming is
 * left out, so the summary changes once per line.
 */
function lastLine(text: string): { key: number; line: string } {
  // Scans back from the end: thinking can run long and this runs on every delta.
  let end = text.lastIndexOf('\n')
  while (end > 0) {
    const start = text.lastIndexOf('\n', end - 1) + 1
    const line = text
      .slice(start, end)
      .replace(/^\s*(?:[#>]+|[-*+]|\d+\.)\s+/, '')
      .replace(/\*\*|`/g, '')
      .trim()
    // The line's offset stays put as the text grows, so it keys the roll.
    if (line) return { key: start, line }
    end = start - 1
  }
  return { key: -1, line: '' }
}

export function ThinkingRow({
  thinking,
  durationMs,
  inProgress,
  animateIn,
}: {
  thinking: string
  durationMs?: number
  inProgress: boolean
  animateIn?: boolean
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  // The block is done once its time lands, even while it is still the reply's last block.
  const running = inProgress && durationMs == null

  useEffect(() => {
    if (!running || !open) return
    const node = bodyRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [running, open, thinking])

  const { key, line } = lastLine(thinking)
  const summary =
    durationMs != null ? (
      <RollingText rollKey="done" text={formatElapsed(durationMs)} />
    ) : running && line && !open ? (
      <RollingText rollKey={key} text={line} shimmer />
    ) : null

  return (
    <ActivityRow
      icon={Brain}
      label={running ? 'Thinking' : 'Thought'}
      summary={summary}
      running={running}
      open={open}
      animateIn={animateIn}
      onOpenChange={setOpen}
    >
      {thinking.trim() ? (
        <div className="mt-2">
          <ScrollFade ref={bodyRef} className="max-h-80 text-muted-foreground">
            <MarkdownBody
              className="space-y-3 leading-relaxed"
              text={thinking}
              streaming={running}
            />
          </ScrollFade>
        </div>
      ) : null}
    </ActivityRow>
  )
}

/** Lifts the old text away and brings the new one up from below whenever `rollKey` changes. */
function RollingText({
  rollKey,
  text,
  shimmer = false,
}: {
  rollKey: string | number
  text: string
  shimmer?: boolean
}) {
  const [current, setCurrent] = useState({ key: rollKey, text })
  const [leaving, setLeaving] = useState<{ key: string | number; text: string } | null>(null)
  const [rolled, setRolled] = useState(false)

  if (current.key !== rollKey) {
    setLeaving(current)
    setCurrent({ key: rollKey, text })
    setRolled(true)
  }

  return (
    <span className="grid min-w-0 grid-cols-[minmax(0,1fr)]">
      {leaving ? (
        <span
          key={`out-${leaving.key}`}
          aria-hidden
          className="col-start-1 row-start-1 animate-roll-out truncate"
          onAnimationEnd={() => setLeaving(null)}
        >
          <span className={cn(shimmer && 'shimmer')}>{leaving.text}</span>
        </span>
      ) : null}
      <span
        key={`in-${current.key}`}
        className={cn('col-start-1 row-start-1 truncate', rolled && 'animate-roll-in')}
      >
        {/* Its own span: shimmer and the roll both set `animation`. */}
        <span className={cn(shimmer && 'shimmer')}>{current.text}</span>
      </span>
    </span>
  )
}
