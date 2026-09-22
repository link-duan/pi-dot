import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Folder, FolderOpen, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { displayPath, folderName } from '@/lib/path'
import { cn } from '@/lib/utils'
import { PATH } from '@/router'
import { useSession } from '@/session/store'
import { PiLogo } from './PiIcon'

export function ProjectLauncher() {
  const navigate = useNavigate()
  const connection = useSession((state) => state.connection)
  const error = useSession((state) => state.error)
  const openFolder = useSession((state) => state.openFolder)
  const openCwd = useSession((state) => state.openCwd)
  const busy = connection === 'connecting'

  const [recentProjects, setRecentProjects] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    void window.pi.getRecentProjects().then(setRecentProjects)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recentProjects
    return recentProjects.filter((path) => {
      const name = folderName(path).toLowerCase()
      const full = path.toLowerCase()
      return name.includes(q) || full.includes(q)
    })
  }, [recentProjects, query])

  const onQueryChange = (value: string) => {
    setQuery(value)
    setSelectedIndex(-1)
  }

  useEffect(() => {
    if (selectedIndex >= 0) {
      const el = itemRefs.current[selectedIndex]
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  async function enter(open: () => Promise<boolean>): Promise<void> {
    if (await open()) navigate(PATH.session, { replace: true })
  }

  const removeProject = useCallback(async (event: React.MouseEvent, path: string) => {
    event.stopPropagation()
    await window.pi.removeRecentProject(path)
    setRecentProjects((prev) => prev.filter((p) => p !== path))
  }, [])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (filtered.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((prev) => {
        if (prev === -1) return 0
        return prev + 1 < filtered.length ? prev + 1 : 0
      })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((prev) => {
        if (prev === -1) return filtered.length - 1
        return prev - 1 >= 0 ? prev - 1 : filtered.length - 1
      })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const target = selectedIndex >= 0 ? filtered[selectedIndex] : filtered[0]
      if (target) void enter(() => openCwd(target))
    } else if (event.key === 'Escape' && query) {
      event.preventDefault()
      onQueryChange('')
    }
  }

  return (
    <main
      className="flex h-full flex-col bg-background text-foreground select-none"
      onKeyDown={onKeyDown}
    >
      {/* Frameless window drag area - provides breathing room for macOS native traffic lights */}
      <div className="app-drag h-10 w-full shrink-0" />

      <div className="flex flex-1 justify-center px-6 pt-[12vh] pb-10">
        {recentProjects.length > 0 ? (
          <div className="flex w-full max-w-[460px] flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 shrink-0 overflow-hidden rounded-lg shadow-xs ring-1 ring-foreground/10">
                  <PiLogo className="block size-10" />
                </div>
                <div>
                  <h1 className="text-base font-semibold tracking-tight text-foreground">Pi Dot</h1>
                  <p className="text-xs text-muted-foreground">
                    Open a local project to get started
                  </p>
                </div>
              </div>

              <Button
                disabled={busy}
                onClick={() => void enter(openFolder)}
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-md text-xs font-medium shadow-none hover:bg-accent"
              >
                <FolderOpen className="size-3.5 text-muted-foreground" />
                <span>Open folder</span>
              </Button>
            </div>

            {/* Recent projects area */}
            <div className="flex flex-col gap-2">
              {/* Filter bar */}
              {recentProjects.length >= 2 ? (
                <div className="relative flex items-center">
                  <Search className="pointer-events-none absolute left-3 size-3.5 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Filter recent projects..."
                    className="h-8.5 w-full rounded-md border-input/60 bg-card/40 pr-8 pl-8.5 text-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                  />
                  {query ? (
                    <button
                      type="button"
                      aria-label="Clear filter"
                      onClick={() => onQueryChange('')}
                      className="absolute right-2.5 flex size-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </div>
              ) : null}

              {/* Projects Card List */}
              <div
                className="overflow-hidden rounded-lg border border-border/60 bg-card/40 backdrop-blur-xs"
                onMouseLeave={() => setSelectedIndex(-1)}
              >
                {filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No matching projects found
                  </div>
                ) : (
                  <ScrollArea className="max-h-72">
                    <ScrollAreaViewport className="divide-y divide-border/30">
                      {filtered.map((path, index) => {
                        const isSelected = index === selectedIndex
                        const name = folderName(path)
                        const rel = displayPath(path, null, window.pi.homedir)

                        return (
                          <button
                            key={path}
                            ref={(el) => {
                              itemRefs.current[index] = el
                            }}
                            type="button"
                            disabled={busy}
                            onClick={() => void enter(() => openCwd(path))}
                            onMouseEnter={() => setSelectedIndex(index)}
                            onMouseLeave={() => setSelectedIndex(-1)}
                            className={cn(
                              'group flex h-8 w-full items-center gap-2.5 px-3 text-left transition-colors outline-none',
                              'first:rounded-t-[7px] last:rounded-b-[7px]',
                              isSelected
                                ? 'bg-accent text-accent-foreground'
                                : 'hover:bg-accent/60',
                            )}
                          >
                            <Folder className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />

                            <span className="shrink-0 text-xs font-medium text-foreground">
                              {name}
                            </span>

                            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                              {rel}
                            </span>

                            <div className="flex shrink-0 items-center pl-1">
                              {busy && isSelected ? (
                                <Spinner className="size-3" />
                              ) : (
                                <button
                                  type="button"
                                  aria-label="Remove from recent"
                                  onClick={(e) => void removeProject(e, path)}
                                  className="flex size-4 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground"
                                >
                                  <X className="size-3" />
                                </button>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </ScrollAreaViewport>
                    <ScrollAreaScrollbar />
                  </ScrollArea>
                )}
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <p className="whitespace-pre-wrap">{error}</p>
              </div>
            ) : null}
          </div>
        ) : (
          /* Empty / First-run Hero Welcome */
          <div className="flex w-full max-w-sm flex-col items-center pt-[6vh] text-center">
            <div className="mb-5 size-12 overflow-hidden rounded-xl shadow-xs ring-1 ring-foreground/10">
              <PiLogo className="block size-12" />
            </div>

            <h1 className="text-xl font-semibold tracking-tight text-foreground">Pi Dot</h1>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Open a local folder to start a coding session.
            </p>

            <div className="mt-6 w-full max-w-64">
              <Button
                disabled={busy}
                onClick={() => void enter(openFolder)}
                size="default"
                className="w-full gap-2 rounded-md text-xs font-medium shadow-xs"
              >
                <FolderOpen className="size-4" />
                <span>Open folder</span>
              </Button>
            </div>

            {error ? (
              <div className="mt-4 w-full rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <p className="whitespace-pre-wrap">{error}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  )
}
