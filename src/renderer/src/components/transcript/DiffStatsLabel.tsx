import type { DiffStats } from '@/components/transcript/tool/diff'

export function DiffStatsLabel({ stats }: { stats: DiffStats }) {
  if (stats.added <= 0 && stats.removed <= 0) return null
  return (
    <span className="shrink-0 font-mono text-xs tabular-nums">
      {stats.added > 0 ? (
        <span className="text-emerald-600 dark:text-emerald-400">+{stats.added}</span>
      ) : null}
      {stats.added > 0 && stats.removed > 0 ? ' ' : null}
      {stats.removed > 0 ? <span className="text-destructive">-{stats.removed}</span> : null}
    </span>
  )
}
