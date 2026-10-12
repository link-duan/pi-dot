import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { createChatState, type ChatState } from '@/chat/state'
import { Composer } from '@/components/Composer'
import { PlanViewer } from '@/components/PlanViewer'
import { Transcript, type TranscriptHandle } from '@/components/transcript/Transcript'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PATH } from '@/router'
import { parsePlan } from '@shared/plan-file'
import { patchChat } from '@/session/state'
import { useChat, useSession } from '@/session/store'
import {
  catalogModel,
  codemodeModel,
  emptyModel,
  playgroundContextUsage,
  planBuiltModel,
  planModel,
  playgroundModel,
  playgroundPlanComments,
  playgroundPlanPath,
  playgroundPlanText,
  playgroundModels,
  playgroundSkills,
  playgroundThinkingLevels,
  runningToolModel,
  thinkingModel,
  waitingModel,
  workingModel,
  queuedModel,
} from './mocks'

const TABS: Array<{ title: string; model: ChatState; agoMs?: number; plan?: string }> = [
  { title: 'Empty', model: emptyModel },
  { title: 'Catalog', model: catalogModel },
  { title: 'Codemode', model: codemodeModel, agoMs: 6_000 },
  { title: 'Thinking', model: thinkingModel, agoMs: 4_200 },
  { title: 'Running tool', model: runningToolModel, agoMs: 2_800 },
  { title: 'Waiting', model: waitingModel, agoMs: 1_500 },
  { title: 'Working', model: workingModel, agoMs: 3_600 },
  { title: 'Queued', model: queuedModel, agoMs: 3_600 },
  { title: 'Plan', model: planModel, plan: playgroundPlanText },
  { title: 'Plan built', model: planBuiltModel, plan: playgroundPlanText },
]

const PLAYGROUND_FILE = '/Users/demo/pi-ui/session.jsonl'

function usePlaygroundSession(model: ChatState, plan = '') {
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
      steer: async (text) => {
        useSession.setState((state) => {
          const chat = state.chats[PLAYGROUND_FILE]
          if (!chat) return state
          return patchChat(state, PLAYGROUND_FILE, {
            steeringQueue: [...chat.steeringQueue, text],
          })
        })
      },
      removeSteering: async (index) => {
        useSession.setState((state) => {
          const chat = state.chats[PLAYGROUND_FILE]
          if (!chat) return state
          return patchChat(state, PLAYGROUND_FILE, {
            steeringQueue: chat.steeringQueue.filter((_, i) => i !== index),
          })
        })
      },
      followUp: async (text) => {
        useSession.setState((state) => {
          const chat = state.chats[PLAYGROUND_FILE]
          if (!chat) return state
          return patchChat(state, PLAYGROUND_FILE, {
            followUpQueue: [...chat.followUpQueue, text],
          })
        })
      },
      setFollowUpQueue: async (messages) => {
        useSession.setState((state) => {
          const chat = state.chats[PLAYGROUND_FILE]
          if (!chat) return state
          return patchChat(state, PLAYGROUND_FILE, {
            followUpQueue: [...messages],
          })
        })
      },
      editFollowUp: async (index, newText) => {
        useSession.setState((state) => {
          const chat = state.chats[PLAYGROUND_FILE]
          if (!chat) return state
          const next = [...chat.followUpQueue]
          next[index] = newText
          return patchChat(state, PLAYGROUND_FILE, { followUpQueue: next })
        })
      },
      deleteFollowUp: async (index) => {
        useSession.setState((state) => {
          const chat = state.chats[PLAYGROUND_FILE]
          if (!chat) return state
          return patchChat(state, PLAYGROUND_FILE, {
            followUpQueue: chat.followUpQueue.filter((_, i) => i !== index),
          })
        })
      },
      moveFollowUp: async (fromIndex, toIndex) => {
        useSession.setState((state) => {
          const chat = state.chats[PLAYGROUND_FILE]
          if (!chat) return state
          const next = [...chat.followUpQueue]
          const [removed] = next.splice(fromIndex, 1)
          if (removed !== undefined) next.splice(toIndex, 0, removed)
          return patchChat(state, PLAYGROUND_FILE, { followUpQueue: next })
        })
      },
      promoteFollowUpToSteer: async (index) => {
        useSession.setState((state) => {
          const chat = state.chats[PLAYGROUND_FILE]
          if (!chat) return state
          const text = chat.followUpQueue[index]
          if (!text) return state
          return patchChat(state, PLAYGROUND_FILE, {
            followUpQueue: chat.followUpQueue.filter((_, i) => i !== index),
            steeringQueue: [...chat.steeringQueue, text],
          })
        })
      },
      clearQueue: async () => {
        useSession.setState((state) =>
          patchChat(state, PLAYGROUND_FILE, {
            steeringQueue: [],
            followUpQueue: [],
          }),
        )
      },
      clearSteeringQueue: async () => {
        useSession.setState((state) =>
          patchChat(state, PLAYGROUND_FILE, {
            steeringQueue: [],
          }),
        )
      },
      abort: async () => {
        useSession.setState((state) =>
          patchChat(state, PLAYGROUND_FILE, {
            isStreaming: false,
            steeringQueue: [],
            followUpQueue: [],
          }),
        )
      },
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
      refreshPlan: async () => {},
      approvePlan: async () => {
        useSession.setState((state) =>
          patchChat(state, PLAYGROUND_FILE, {
            planMode: false,
            planActive: false,
            plan: { path: playgroundPlanPath, built: true },
          }),
        )
      },
    })
    return () => {
      useSession.setState(prev)
    }
  }, [])

  useEffect(() => {
    useSession.setState((state) => ({
      ...state,
      chats: {
        ...state.chats,
        [PLAYGROUND_FILE]: model,
      },
      planText: plan,
      planSource: plan ? playgroundPlanPath : '',
      planViewer: false,
      planComments: plan && !model.plan?.built ? playgroundPlanComments(parsePlan(plan).body) : [],
    }))
  }, [model, plan])
}

export function Playground() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(TABS[1]?.title ?? TABS[0].title)
  const pane = TABS.find((item) => item.title === tab) ?? TABS[0]
  const scrollerRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<TranscriptHandle>(null)
  const [startedAt] = useState(() => Date.now())
  const model = useMemo(
    () =>
      pane.agoMs == null ? pane.model : { ...pane.model, turnStartedAt: startedAt - pane.agoMs },
    [pane, startedAt],
  )
  usePlaygroundSession(model, pane.plan)
  const chat = useChat()
  const activeModel = chat.messages.length > 0 || chat.steeringQueue.length > 0 ? chat : model

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="app-drag flex h-9 shrink-0 items-center gap-2 overflow-hidden border-b border-border pr-3 pl-20">
        <nav className="app-no-drag flex shrink-0 items-center gap-0.5">
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
        <div className="app-drag h-full min-w-0 flex-1" />
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
      <Transcript
        ref={transcriptRef}
        key={pane.title}
        scrollerRef={scrollerRef}
        model={activeModel}
        follow={false}
      />
      <Composer onSend={() => transcriptRef.current?.scrollToBottom()} />
      <PlanViewer />
    </div>
  )
}
