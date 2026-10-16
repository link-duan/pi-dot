import { memo } from 'react'

/** A labeled rule across the transcript, marking an event such as a compaction. */
export const DividerRow = memo(function DividerRow({ label }: { label: string }) {
  return (
    <div className="my-2 flex items-center justify-center gap-2">
      <div className="h-px flex-1 bg-border" />
      <span className="rounded-full px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
})
