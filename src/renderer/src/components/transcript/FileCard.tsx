import type { ReactNode } from 'react'
import { CodeBlockCopyButton } from 'streamdown'
import { DiffStatsLabel } from './DiffStatsLabel'
import type { DiffStats } from '@/components/transcript/tool/diff'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ScrollFade } from '@/components/ui/scroll-area'

export function FileCard({
  path,
  stats,
  copy,
  className,
  children,
}: {
  path: string
  stats?: DiffStats | null
  copy: string
  className?: string
  children: ReactNode
}) {
  return (
    <div data-wide="" className={cn('mt-2 w-full rounded-xl border border-border pt-2', className)}>
      <div className="flex items-center gap-2 px-2">
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          {path ? (
            <Tooltip>
              <TooltipTrigger
                render={<span />}
                className="min-w-0 cursor-default truncate font-mono text-xs text-muted-foreground"
              >
                {path}
              </TooltipTrigger>
              <TooltipContent className="max-w-lg font-mono text-xs break-all">
                {path}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {stats ? <DiffStatsLabel stats={stats} /> : null}
        </span>
        <CodeBlockCopyButton code={copy} />
      </div>
      <ScrollFade
        rootClassName="mt-2 border-t border-border"
        className="max-h-96 py-2 font-mono text-xs leading-relaxed"
        scrollbarClassName="my-0.5"
      >
        {children}
      </ScrollFade>
    </div>
  )
}
