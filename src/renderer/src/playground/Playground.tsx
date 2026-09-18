import { useRef, useState } from 'react'
import type { ChatState } from '@/chat/state'
import { Transcript } from '@/components/Transcript'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  catalogModel,
  emptyModel,
  runningToolModel,
  thinkingModel,
  waitingModel,
  workingModel,
} from './mocks'

const TABS: Array<{ title: string; model: ChatState; agoMs?: number }> = [
  { title: 'Empty', model: emptyModel },
  { title: 'Catalog', model: catalogModel },
  { title: 'Thinking', model: thinkingModel, agoMs: 4_200 },
  { title: 'Running tool', model: runningToolModel, agoMs: 2_800 },
  { title: 'Waiting', model: waitingModel, agoMs: 1_500 },
  { title: 'Working', model: workingModel, agoMs: 3_600 },
]

export function Playground() {
  const [tab, setTab] = useState(TABS[1]?.title ?? TABS[0].title)
  const pane = TABS.find((item) => item.title === tab) ?? TABS[0]
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [startedAt] = useState(() => Date.now())
  const model =
    pane.agoMs == null ? pane.model : { ...pane.model, turnStartedAt: startedAt - pane.agoMs }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="app-drag flex shrink-0 items-center gap-2 overflow-hidden border-b border-border py-1.5 pr-3 pl-20">
        <nav className="app-no-drag flex min-w-0 flex-1 items-center gap-0.5">
          {TABS.map((item) => {
            const selected = item.title === pane.title
            return (
              <Button
                key={item.title}
                type="button"
                size="xs"
                variant="ghost"
                aria-pressed={selected}
                className={cn(
                  'text-muted-foreground',
                  selected && 'bg-muted text-foreground hover:bg-muted hover:text-foreground',
                )}
                onClick={() => setTab(item.title)}
              >
                {item.title}
              </Button>
            )
          })}
        </nav>
        <div className="app-no-drag flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => document.documentElement.classList.toggle('dark')}
          >
            Theme
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              window.location.hash = '/'
            }}
          >
            Back
          </Button>
        </div>
      </header>
      <Transcript key={pane.title} scrollerRef={scrollerRef} model={model} follow={false} />
    </div>
  )
}
