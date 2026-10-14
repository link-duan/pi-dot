import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { SessionListItem } from '@shared/protocol'
import { userText } from '@/chat/state'
import { FileChip } from '@/components/composer/FileChip'
import { SkillChip } from '@/components/composer/SkillChip'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollFade } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { fileChipLabel } from '@/lib/file-token'
import {
  formatRelativeTime,
  groupByTime,
  sessionTitle,
  sessionTitleSegments,
  TIME_GROUP_LABELS,
} from '@/lib/format'
import { folderName } from '@/lib/path'
import { cn } from '@/lib/utils'
import { useChat, useSession } from '@/session/store'

/**
 * The window title, the project and the active session. Clicking the name renames it in place; the
 * chevron opens the session list to switch sessions (also Ctrl+R).
 */
export function SessionSwitcher({ cwd }: { cwd: string }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [items, setItems] = useState<SessionListItem[] | null>(null)
  const sessionFile = useSession((state) => state.sessionFile)
  const connection = useSession((state) => state.connection)
  const runningFiles = useSession((state) => state.running)
  const attention = useSession((state) => state.attention)
  const needsLook = Object.keys(attention).length > 0
  const listSessions = useSession((state) => state.listSessions)
  const switchSession = useSession((state) => state.switchSession)
  const name = useChat((chat) => chat.sessionName)
  const firstMessage = useChat((chat) => {
    const first = chat.messages.find((message) => message.role === 'user')
    return first?.role === 'user' ? userText(first) : undefined
  })
  const title =
    name?.trim() || firstMessage?.trim() ? sessionTitle({ name, firstMessage }) : 'New session'
  const canSwitch = connection === 'ready'
  const folder = folderName(cwd)
  const barRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const returnToComposer = useRef(false)

  const setListOpen = useCallback(
    (next: boolean) => {
      if (next) {
        setSelected(sessionFile ?? '')
        setQuery('')
      } else returnToComposer.current = true
      setOpen(next)
    },
    [sessionFile],
  )

  useEffect(() => {
    if (editing) return
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'r' || !event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      setListOpen(!open)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editing, open, setListOpen])

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
    <Popover open={open} onOpenChange={setListOpen}>
      <div
        ref={barRef}
        className="app-no-drag flex h-6 min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        <span className="shrink-0 opacity-70">{folder}</span>
        <span className="shrink-0 text-muted-foreground/40">/</span>
        {editing ? (
          <TitleEditor
            title={title}
            onDone={() => {
              setEditing(false)
              useSession.getState().requestComposerFocus()
            }}
          />
        ) : (
          <button
            type="button"
            aria-label={`Rename session: ${title}`}
            className="max-w-[24rem] min-w-0 cursor-text truncate outline-none hover:text-foreground focus-visible:text-foreground"
            onClick={() => {
              // Clicking here closes an open list; keep its focus return off the Composer.
              returnToComposer.current = false
              setEditing(true)
            }}
          >
            {title}
          </button>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="relative -ml-1 text-muted-foreground aria-expanded:bg-transparent aria-expanded:text-foreground"
                    aria-label={needsLook ? 'Switch session (sessions need you)' : 'Switch session'}
                  />
                }
              />
            }
          >
            <ChevronDown className="transition-transform in-aria-expanded:rotate-180" />
            {needsLook ? (
              <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-plan" />
            ) : null}
          </TooltipTrigger>
          <TooltipContent>
            Switch session
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>R</Kbd>
            </KbdGroup>
          </TooltipContent>
        </Tooltip>
      </div>

      <PopoverContent
        anchor={barRef}
        align="center"
        sideOffset={6}
        className="w-[32rem] gap-0 overflow-hidden rounded-2xl p-0"
        initialFocus={searchRef}
        finalFocus={() => {
          if (!returnToComposer.current) return false
          returnToComposer.current = false
          useSession.getState().requestComposerFocus()
          return false
        }}
      >
        <Command
          value={selected}
          onValueChange={setSelected}
          className="[&_[data-slot=command-input-wrapper]]:border-border/60"
        >
          <CommandInput
            ref={searchRef}
            value={query}
            onValueChange={setQuery}
            placeholder="Search sessions..."
            className="h-10 px-4 text-[13px]"
          />
          <ScrollFade
            className="max-h-[min(28rem,60vh)] overscroll-contain"
            scrollbarClassName="my-1"
          >
            <CommandList className="overflow-visible px-1 py-1">
              {items === null || items.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {items === null ? 'Loading…' : 'No sessions yet'}
                </div>
              ) : (
                <>
                  <CommandEmpty className="py-8 text-xs">No matching sessions</CommandEmpty>
                  {groupByTime(items).map(({ group, items: groupItems }) => (
                    <CommandGroup
                      key={group}
                      heading={TIME_GROUP_LABELS[group]}
                      className="**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-normal"
                    >
                      {groupItems.map((item) => {
                        const itemTitle = sessionTitle(item)
                        const current = item.path === sessionFile
                        const running = runningFiles.includes(item.path)
                        const mark = current ? undefined : attention[item.path]
                        return (
                          <CommandItem
                            key={item.path}
                            value={item.path}
                            keywords={[itemTitle, item.firstMessage ?? '']}
                            disabled={!canSwitch && !current}
                            className="h-8 gap-2 rounded-lg px-2.5 py-0 text-[13px]"
                            onSelect={() => {
                              if (current || !canSwitch) {
                                setListOpen(false)
                                return
                              }
                              void switchSession(item.path).then(() => setListOpen(false))
                            }}
                          >
                            <span className="flex size-3 shrink-0 items-center justify-center">
                              {running ? (
                                <Spinner className="size-3" aria-label="Running" />
                              ) : (
                                <span
                                  className={cn(
                                    'size-1.5 rounded-full',
                                    mark === 'input'
                                      ? 'bg-plan'
                                      : current || mark === 'done'
                                        ? 'bg-foreground'
                                        : 'bg-muted-foreground/50',
                                  )}
                                />
                              )}
                            </span>
                            <SessionItemTitle item={item} />
                            {current || mark ? (
                              <span
                                className={cn(
                                  'shrink-0 text-xs',
                                  mark === 'input' ? 'text-plan' : 'text-muted-foreground',
                                )}
                              >
                                {current ? 'current' : mark === 'input' ? 'needs input' : 'new'}
                              </span>
                            ) : null}
                            <span className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
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
          </ScrollFade>
          <div className="flex h-8 shrink-0 items-center gap-4 border-t border-border/60 px-4 text-[11px] text-muted-foreground/70">
            <span>↑↓ Select</span>
            <span>↵ Open</span>
            <span>esc Close</span>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Renames the active session in the title, starting from the shown title: Enter or leaving the field
 * saves a changed name, Esc drops it.
 */
function TitleEditor({ title, onDone }: { title: string; onDone: () => void }) {
  const renameSession = useSession((state) => state.renameSession)
  const [draft, setDraft] = useState(title)
  const settled = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.select(), [])
  const finish = (save: boolean) => {
    if (settled.current) return
    settled.current = true
    const next = draft.trim()
    if (save && next && next !== title) void renameSession(next)
    onDone()
  }

  return (
    <input
      ref={inputRef}
      aria-label="Session name"
      value={draft}
      placeholder={title}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          finish(true)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          finish(false)
        }
      }}
      onBlur={() => finish(true)}
      className="field-sizing-content max-w-[24rem] min-w-8 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
    />
  )
}

const chipClass = 'mr-1 align-bottom group-data-selected/command-item:bg-background'

function SessionItemTitle({ item }: { item: SessionListItem }) {
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
