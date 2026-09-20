import { useCallback, useEffect, useState } from 'react'
import { History } from 'lucide-react'
import type { SessionListItem } from '@shared/protocol'
import { FileChip } from '@/components/composer/FileChip'
import { SkillChip } from '@/components/composer/SkillChip'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Spinner } from '@/components/ui/spinner'
import { fileChipLabel } from '@/lib/file-token'
import { cn } from '@/lib/utils'
import {
  formatRelativeTime,
  groupByTime,
  sessionTitle,
  sessionTitleSegments,
  TIME_GROUP_LABELS,
} from '@/lib/format'
import { useSession } from '@/session/store'

export function SessionSwitcher() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [items, setItems] = useState<SessionListItem[] | null>(null)
  const sessionFile = useSession((state) => state.sessionFile)
  const connection = useSession((state) => state.connection)
  const runningFiles = useSession((state) => state.running)
  const listSessions = useSession((state) => state.listSessions)
  const switchSession = useSession((state) => state.switchSession)
  const canSwitch = connection === 'ready'

  const setListOpen = useCallback(
    (next: boolean) => {
      if (next) setSelected(sessionFile ?? '')
      setOpen(next)
    },
    [sessionFile],
  )

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'r' || !event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      setListOpen(!open)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setListOpen])

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
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="app-no-drag text-muted-foreground"
              aria-label="Session history"
              onClick={() => setListOpen(true)}
            />
          }
        >
          <History />
        </TooltipTrigger>
        <TooltipContent>
          Session history
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>R</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>

      <CommandDialog
        open={open}
        onOpenChange={setListOpen}
        title="Session history"
        description="Search and switch sessions in this project"
        value={selected}
        onValueChange={setSelected}
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
                    const running = runningFiles.includes(item.path)
                    return (
                      <CommandItem
                        key={item.path}
                        value={item.path}
                        keywords={[title, item.firstMessage ?? '']}
                        disabled={!canSwitch && !current}
                        onSelect={() => {
                          if (current || !canSwitch) {
                            setOpen(false)
                            return
                          }
                          void switchSession(item.path).then(() => setOpen(false))
                        }}
                      >
                        <span
                          className={cn(
                            'size-1.5 shrink-0 rounded-full',
                            current ? 'bg-foreground' : 'bg-muted-foreground/55',
                          )}
                        />
                        <SessionTitle item={item} />
                        {running ? (
                          <Spinner className="size-3 shrink-0" aria-label="Running" />
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {formatRelativeTime(item.modified)}
                          </span>
                        )}
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

const chipClass = 'mr-1 align-bottom group-data-selected/command-item:bg-background'

function SessionTitle({ item }: { item: SessionListItem }) {
  return (
    <span className="min-w-0 flex-1 truncate leading-5 text-muted-foreground group-data-selected/command-item:text-foreground">
      {sessionTitleSegments(item).map((segment, index) =>
        segment.type === 'skill' ? (
          <SkillChip key={`${segment.name}:${index}`} name={segment.name} className={chipClass} />
        ) : segment.type === 'file' ? (
          <FileChip
            key={`${segment.path}:${index}`}
            label={fileChipLabel(segment.path, segment.range)}
            title={segment.path}
            directory={segment.path.endsWith('/')}
            className={chipClass}
          />
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </span>
  )
}
