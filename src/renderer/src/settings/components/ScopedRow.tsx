import { RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SettingsScope } from '@shared/settings'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { SettingBadge } from './SettingBadge'

export function ScopedRow({
  title,
  description,
  scope,
  userOnly,
  overridden,
  onReset,
  onShowWorkspace,
  children,
}: {
  title: string
  description?: string
  scope: SettingsScope
  userOnly?: boolean
  /** The workspace sets this value. */
  overridden: boolean
  onReset: () => void
  onShowWorkspace: () => void
  children: ReactNode
}) {
  const inWorkspace = scope === 'workspace'
  const inherited = inWorkspace && !overridden && !userOnly
  return (
    <div
      data-overridden={inWorkspace && overridden ? '' : undefined}
      className="relative flex items-center justify-between gap-6 px-4 py-3 text-sm transition-colors hover:bg-muted/15"
    >
      {inWorkspace && overridden ? (
        <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          {title}
          {inWorkspace && userOnly ? <SettingBadge>User only</SettingBadge> : null}
          {inWorkspace && overridden ? (
            <span className="text-[11px] font-normal text-primary">Set in workspace</span>
          ) : null}
        </span>
        {description ? (
          <span className="text-xs leading-normal text-muted-foreground">{description}</span>
        ) : null}
        {inherited ? (
          <span className="text-[11px] text-muted-foreground/70">Inherited from User</span>
        ) : null}
        {!inWorkspace && overridden ? (
          <button
            type="button"
            className="w-fit text-[11px] text-primary underline-offset-2 outline-none hover:underline focus-visible:underline"
            onClick={onShowWorkspace}
          >
            Overridden in workspace
          </button>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {inWorkspace && overridden ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Reset ${title} to the User value`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={onReset}
                />
              }
            >
              <RotateCcw className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Reset to User value</TooltipContent>
          </Tooltip>
        ) : null}
        <div className={cn('flex items-center gap-2', inherited && 'opacity-60 hover:opacity-100')}>
          {children}
        </div>
      </div>
    </div>
  )
}
