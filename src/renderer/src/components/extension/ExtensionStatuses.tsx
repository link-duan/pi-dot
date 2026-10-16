import { ShieldOff } from 'lucide-react'
import { AnsiText } from './AnsiText'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useChat, useSession } from '@/session/store'
import { stripAnsi } from './strip-ansi'

/** The Composer footer's extension statuses, and the mark of an untrusted folder. */
export function ExtensionStatuses() {
  const statuses = Object.entries(useChat((chat) => chat.ui.statuses))
  const trusted = useSession((state) => state.trusted)
  const retrust = useSession((state) => state.retrust)
  return (
    <>
      {trusted ? null : (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => void retrust()}
                className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              />
            }
          >
            <ShieldOff className="size-3" />
            Untrusted
          </TooltipTrigger>
          <TooltipContent>
            Project extensions, settings and skills are not loaded. Click to trust this folder.
          </TooltipContent>
        </Tooltip>
      )}
      {statuses.length > 0 ? (
        <span
          className="ml-1 flex min-w-0 items-center gap-2 overflow-hidden text-xs whitespace-nowrap text-muted-foreground select-none"
          title={statuses.map(([, text]) => stripAnsi(text)).join('  ')}
        >
          {statuses.map(([key, text]) => (
            <span key={key} className="shrink-0">
              <AnsiText text={text} />
            </span>
          ))}
        </span>
      ) : null}
    </>
  )
}
