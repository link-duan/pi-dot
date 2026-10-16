import { useEffect, useState } from 'react'
import { FolderOpen, X } from 'lucide-react'
import { Navigate } from 'react-router'
import type { RecentProject } from '@shared/protocol'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { Kbd } from '@/components/ui/kbd'
import { Spinner } from '@/components/ui/spinner'
import { formatRelativeTime } from '@/lib/format'
import { displayPath, folderName } from '@/lib/path'
import { cn } from '@/lib/utils'
import { PATH } from '@/router'
import { useSession } from '@/session/store'
import { PiLogo } from './PiLogo'

const OPEN_FOLDER = 'open-folder'

/** The first screen of a Window without a folder: recent projects to pick up, or a new one to open. */
export function ProjectLauncher() {
  const connection = useSession((state) => state.connection)
  const error = useSession((state) => state.error)
  const openFolder = useSession((state) => state.openFolder)
  const openCwd = useSession((state) => state.openCwd)
  const cwd = useSession((state) => state.cwd)
  const busy = connection === 'connecting'

  const [projects, setProjects] = useState<RecentProject[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [opening, setOpening] = useState<string | null>(null)

  useEffect(() => {
    void window.pi.getRecentProjects().then(setProjects)
  }, [])

  // A Window bound to a folder shows its session, at startup or on reload.
  if (cwd) return <Navigate to={PATH.session} replace />

  const q = query.trim().toLowerCase()
  const filtered = q ? projects.filter((p) => p.cwd.toLowerCase().includes(q)) : projects

  const open = (path: string) => {
    if (busy) return
    setOpening(path)
    void openCwd(path).finally(() => setOpening(null))
  }

  const remove = (path: string) => {
    void window.pi.removeRecentProject(path)
    setProjects((prev) => prev.filter((p) => p.cwd !== path))
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && query) {
      event.preventDefault()
      setQuery('')
    } else if (
      event.key === 'Backspace' &&
      event.metaKey &&
      !query &&
      selected &&
      selected !== OPEN_FOLDER
    ) {
      event.preventDefault()
      remove(selected)
    }
  }

  return (
    <main className="flex h-full flex-col bg-background text-foreground select-none">
      {/* Room for the macOS traffic lights, and a handle to drag the frameless window. */}
      <div className="app-drag h-10 w-full shrink-0" />

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col items-center px-6',
          // A list grows downward from a fixed top; a lone button sits a little above center.
          projects.length > 0 ? 'pt-[12vh] pb-10' : 'justify-center pb-[12vh]',
        )}
      >
        <PiLogo className="size-8 shrink-0" />

        {projects.length > 0 ? (
          <Command
            shouldFilter={false}
            value={selected}
            onValueChange={setSelected}
            onKeyDown={onKeyDown}
            className="mt-10 min-h-0 max-w-[480px] bg-transparent"
          >
            <CommandInput
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search recent projects…"
              className="px-2.5"
            />
            <CommandList className="px-0">
              {q ? null : (
                <CommandItem
                  value={OPEN_FOLDER}
                  disabled={busy}
                  onSelect={() => void openFolder()}
                  className="cursor-pointer"
                >
                  <FolderOpen className="text-muted-foreground" />
                  Open folder…
                  <CommandShortcut>⌘O</CommandShortcut>
                </CommandItem>
              )}
              {filtered.length > 0 ? (
                <CommandGroup heading={q ? undefined : 'Recent'} className="mt-3">
                  {filtered.map((project) => (
                    <ProjectItem
                      key={project.cwd}
                      project={project}
                      opening={opening === project.cwd}
                      disabled={busy}
                      onOpen={() => open(project.cwd)}
                      onRemove={() => remove(project.cwd)}
                    />
                  ))}
                </CommandGroup>
              ) : q ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No matching projects
                </p>
              ) : null}
            </CommandList>
          </Command>
        ) : (
          <Button
            autoFocus
            variant="outline"
            disabled={busy}
            onClick={() => void openFolder()}
            className="mt-6 gap-2"
          >
            <FolderOpen className="text-muted-foreground" />
            Open folder
            <Kbd>⌘O</Kbd>
          </Button>
        )}

        {error ? (
          <p className="mt-4 w-full max-w-[480px] px-2.5 text-xs whitespace-pre-wrap text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  )
}

function ProjectItem({
  project,
  opening,
  disabled,
  onOpen,
  onRemove,
}: {
  project: RecentProject
  opening: boolean
  disabled: boolean
  onOpen: () => void
  onRemove: () => void
}) {
  const parent = project.cwd.slice(0, project.cwd.lastIndexOf('/')) || '/'

  return (
    <CommandItem
      value={project.cwd}
      disabled={disabled && !opening}
      onSelect={() => {
        if (!disabled) onOpen()
      }}
      className="group cursor-pointer"
    >
      <span className="shrink-0">{folderName(project.cwd)}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {displayPath(parent, null, window.pi.homedir)}
      </span>

      {opening ? (
        <Spinner className="size-3.5 text-muted-foreground" />
      ) : (
        <span className="relative flex shrink-0 items-center justify-end">
          {/* The last activity gives way to the remove button on hover. */}
          <span className="text-xs text-muted-foreground tabular-nums group-hover:invisible">
            {project.lastActive ? formatRelativeTime(project.lastActive) : null}
          </span>
          <button
            type="button"
            aria-label="Remove from recent"
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            className="invisible absolute right-0 flex size-5 items-center justify-center rounded text-muted-foreground group-hover:visible hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </span>
      )}
    </CommandItem>
  )
}
