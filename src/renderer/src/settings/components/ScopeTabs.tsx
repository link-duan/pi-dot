import { Folder, User } from 'lucide-react'
import type { SettingsScope, WorkspaceSettings } from '@shared/settings'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function ScopeTabs({
  scope,
  workspace,
  onChange,
}: {
  scope: SettingsScope
  workspace: WorkspaceSettings | null
  onChange: (scope: SettingsScope) => void
}) {
  const overrides = workspace ? Object.keys(workspace.overrides).length : 0
  return (
    <div
      role="tablist"
      aria-label="Settings scope"
      className="inline-flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
    >
      <ScopeTab active={scope === 'user'} onClick={() => onChange('user')}>
        <User className="size-3.5" />
        User
      </ScopeTab>
      {workspace ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <ScopeTab active={scope === 'workspace'} onClick={() => onChange('workspace')}>
                <Folder className="size-3.5" />
                Workspace
                {overrides ? (
                  <span className="rounded-full bg-primary/15 px-1.5 text-[10px] leading-4 font-medium text-primary tabular-nums">
                    {overrides}
                  </span>
                ) : null}
              </ScopeTab>
            }
          />
          <TooltipContent>{workspace.path}/.pi/settings.json</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <span>
                <ScopeTab active={false} disabled>
                  <Folder className="size-3.5" />
                  Workspace
                </ScopeTab>
              </span>
            }
          />
          <TooltipContent>Open a folder in this window to change its settings</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

function ScopeTab({
  active,
  className,
  ...props
}: React.ComponentProps<'button'> & { active: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
        active && 'bg-background text-foreground shadow-xs',
        className,
      )}
      {...props}
    />
  )
}
