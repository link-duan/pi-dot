import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import type { SessionListItem } from '@shared/protocol'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { formatRelativeTime, groupByTime, sessionTitle, TIME_GROUP_LABELS } from '@/lib/format'
import { useSession } from '@/session/store'

export function SessionSwitcher() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<SessionListItem[] | null>(null)
  const sessionFile = useSession((state) => state.sessionFile)
  const connection = useSession((state) => state.connection)
  const runningSessionFiles = useSession((state) => state.runningSessionFiles)
  const listSessions = useSession((state) => state.listSessions)
  const switchSession = useSession((state) => state.switchSession)
  const canSwitch = connection === 'ready'

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'r' || !event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      setOpen((current) => !current)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listSessions()
      .then((next) => {
        if (!cancelled) setItems(next)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [open, listSessions])

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="app-no-drag text-muted-foreground"
        aria-label="Session history"
        title="Session history (Ctrl+R)"
        onClick={() => setOpen(true)}
      >
        <History />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Session history"
        description="Search and switch sessions in this project"
      >
        <CommandInput placeholder="Search sessions..." />
        <CommandList>
          {items === null ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
          ) : items.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No sessions</div>
          ) : (
            <>
              <CommandEmpty>No matching sessions</CommandEmpty>
              {groupByTime(items).map(({ group, items: groupItems }) => (
                <CommandGroup key={group} heading={TIME_GROUP_LABELS[group]}>
                  {groupItems.map((item) => {
                    const title = sessionTitle(item)
                    const current = item.path === sessionFile
                    const running = runningSessionFiles.includes(item.path)
                    return (
                      <CommandItem
                        key={item.path}
                        value={`${title} ${item.firstMessage ?? ''} ${item.id}`}
                        disabled={!canSwitch && !current}
                        onSelect={() => {
                          if (current || !canSwitch) {
                            setOpen(false)
                            return
                          }
                          void switchSession(item.path).then(() => setOpen(false))
                        }}
                      >
                        {running ? (
                          <Spinner className="size-3" aria-label="Running" />
                        ) : (
                          <span
                            className={cn(
                              'size-1.5 shrink-0 rounded-full',
                              current ? 'bg-foreground' : 'bg-muted-foreground/55',
                            )}
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate text-muted-foreground group-data-selected/command-item:text-foreground">
                          {title}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {formatRelativeTime(item.modified)}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))}
            </>
          )}
        </CommandList>
        <div className="flex shrink-0 items-center gap-3 border-t px-3.5 py-1.5 text-xs text-muted-foreground">
          <span>↑↓ Select</span>
          <span>↵ Open</span>
        </div>
      </CommandDialog>
    </>
  )
}
