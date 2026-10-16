import type { LucideIcon } from 'lucide-react'

/** A floating pill in the Composer's action bar, e.g. a built plan; later Commit or Push. */
export function ActionPill({
  icon: Icon,
  label,
  title = label,
  onClick,
}: {
  icon: LucideIcon
  label: string
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex h-7 max-w-80 min-w-0 items-center gap-1.5 rounded-full border border-border bg-card/90 pr-3 pl-2.5 text-xs text-muted-foreground backdrop-blur-md transition-colors hover:bg-muted hover:text-foreground dark:bg-card/95"
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}
