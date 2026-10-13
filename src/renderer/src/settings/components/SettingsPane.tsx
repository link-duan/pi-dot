import { ChevronRight } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@/components/ui/scroll-area'

export interface Crumb {
  label: string
  onClick?: () => void
}

/**
 * A settings page: a centered column under a header. `fill` drops the scroll area so the
 * children can take the remaining height (e.g. an editor that scrolls itself).
 */
export function SettingsPane({
  crumbs,
  action,
  fill = false,
  children,
}: {
  crumbs: Crumb[]
  action?: ReactNode
  fill?: boolean
  children: ReactNode
}) {
  if (fill) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-10 pt-11 pb-8">
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
          <PaneHeader crumbs={crumbs} action={action} />
          {children}
        </div>
      </div>
    )
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ScrollArea className="flex-1">
        <ScrollAreaViewport className="px-10 pt-11 pb-10">
          <div className="mx-auto max-w-3xl">
            <PaneHeader crumbs={crumbs} action={action} />
            {children}
          </div>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar className="my-3" />
      </ScrollArea>
    </div>
  )
}

function PaneHeader({ crumbs, action }: { crumbs: Crumb[]; action?: ReactNode }) {
  return (
    <div className="mb-6 flex min-h-7 items-center justify-between gap-4">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          return (
            <Fragment key={index}>
              {index > 0 ? (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
              ) : null}
              {last || !crumb.onClick ? (
                <h2
                  className={
                    last
                      ? 'truncate text-lg font-semibold tracking-tight text-foreground'
                      : 'shrink-0 text-lg font-semibold tracking-tight text-muted-foreground'
                  }
                >
                  {crumb.label}
                </h2>
              ) : (
                <button
                  type="button"
                  className="shrink-0 rounded-md text-lg font-semibold tracking-tight text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={crumb.onClick}
                >
                  {crumb.label}
                </button>
              )}
            </Fragment>
          )
        })}
      </nav>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  )
}
