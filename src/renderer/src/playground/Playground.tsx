import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { createChatState, type ChatState } from '@/chat/state'
import { Composer } from '@/components/Composer'
import { Transcript } from '@/components/transcript/Transcript'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PATH } from '@/router'
import { patchChat } from '@/session/state'
import { useSession } from '@/session/store'
import {
  catalogModel,
  emptyModel,
  playgroundContextUsage,
  playgroundModel,
  playgroundModels,
  playgroundSkills,
  playgroundThinkingLevels,
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

const PLAYGROUND_FILE = '/Users/demo/pi-ui/session.jsonl'

function usePlaygroundSession(isStreaming: boolean) {
  useEffect(() => {
    const prev = useSession.getState()
    useSession.setState({
      cwd: '/Users/demo/pi-ui',
      connection: 'ready',
      error: null,
      sessionFile: PLAYGROUND_FILE,
      chats: { [PLAYGROUND_FILE]: createChatState() },
      models: playgroundModels,
      model: playgroundModel,
      thinkingLevel: 'low',
      thinkingLevels: playgroundThinkingLevels,
      skills: playgroundSkills,
      contextUsage: playgroundContextUsage,
      send: async () => {},
      abort: async () => {},
      openFolder: async () => false,
      setModel: async (provider, modelId) => {
        const next = playgroundModels.find(
          (item) => item.provider === provider && item.id === modelId,
        )
        if (next) useSession.setState({ model: next })
      },
      setThinkingLevel: async (level) => {
        useSession.setState({ thinkingLevel: level })
      },
    })
    return () => {
      useSession.setState(prev)
    }
  }, [])

  useEffect(() => {
    useSession.setState((state) => patchChat(state, PLAYGROUND_FILE, { isStreaming }))
  }, [isStreaming])
}

export function Playground() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(TABS[1]?.title ?? TABS[0].title)
  const pane = TABS.find((item) => item.title === tab) ?? TABS[0]
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [startedAt] = useState(() => Date.now())
  const model =
    pane.agoMs == null ? pane.model : { ...pane.model, turnStartedAt: startedAt - pane.agoMs }
  usePlaygroundSession(model.isStreaming)

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
            onClick={() => navigate(PATH.launcher, { replace: true })}
          >
            Back
          </Button>
        </div>
      </header>
      <Transcript key={pane.title} scrollerRef={scrollerRef} model={model} follow={false} />
      <Composer />
    </div>
  )
}
