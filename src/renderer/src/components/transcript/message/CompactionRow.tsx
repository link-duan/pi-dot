import { memo } from 'react'

export const CompactionRow = memo(function CompactionRow() {
  return (
    <div className="my-2 flex items-center justify-center gap-2">
      <div className="h-px flex-1 bg-border" />
      <span className="rounded-full px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
        Context Compacted
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
})
