import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { createChatState, userText, type ChatState } from '@/chat/state'
import { Composer } from '@/components/Composer'
import { SessionSwitcher } from '@/components/SessionSwitcher'
import { PlanViewer } from '@/components/PlanViewer'
import { Transcript, type TranscriptHandle } from '@/components/transcript/Transcript'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { notify } from '@/ipc'
import { PATH } from '@/router'
import { parsePlan } from '@shared/plan-file'
import { activeChat, patchChat, type WindowState } from '@/session/state'
import { useChat, useSession } from '@/session/store'
import {
  catalogModel,
  codemodeModel,
  editingFill,
  editingModel,
  emptyModel,
  extensionModel,
  noModelsChatModel,
  playgroundCommands,
  playgroundSessions,
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
  questionModel,
} from './mocks'

const PLAYGROUND_FILE = '/Users/demo/pi-ui/session.jsonl'

type Tab = {
  title: string
  model: ChatState
  agoMs?: number
  plan?: string
  /** Window state this tab needs on top of the defaults. */
  session?: Partial<WindowState>
}

const TABS: Tab[] = [
  { title: 'Empty', model: emptyModel },
  { title: 'Catalog', model: catalogModel },
  { title: 'Codemode', model: codemodeModel, agoMs: 6_000 },
  { title: 'Thinking', model: thinkingModel, agoMs: 4_200 },
  { title: 'Running tool', model: runningToolModel, agoMs: 2_800 },
  { title: 'Waiting', model: waitingModel, agoMs: 1_500 },
  { title: 'Working', model: workingModel, agoMs: 3_600 },
  { title: 'Queued', model: queuedModel, agoMs: 3_600 },
  { title: 'Question', model: questionModel, agoMs: 4_000 },
  { title: 'Plan', model: planModel, plan: playgroundPlanText },
  { title: 'Plan built', model: planBuiltModel, plan: playgroundPlanText },
  { title: 'Extensions', model: extensionModel, session: { trusted: false } },
  {
    title: 'Editing',
    model: editingModel,
    session: {
      editing: { sessionFile: PLAYGROUND_FILE, leafId: 'playground-leaf' },
      composerFill: { text: editingFill },
    },
  },
  { title: 'No models', model: emptyModel, session: { models: [], model: null } },
  { title: 'No models (chat)', model: noModelsChatModel, session: { models: [], model: null } },
]

/** What every tab starts from, so one tab's `session` does not leak into the next. */
const TAB_DEFAULTS: Partial<WindowState> = {
  models: playgroundModels,
  model: playgroundModel,
  trusted: true,
  editing: null,
  // Each tab opens with an empty Composer; Editing fills it instead.
  composerFill: { text: '' },
}

function usePlaygroundSession(model: ChatState, plan = '', session?: Partial<WindowState>) {
  useEffect(() => {
    const prev = useSession.getState()
    useSession.setState({
      cwd: '/Users/demo/pi-ui',
      connection: 'ready',
      error: null,
      sessionFile: PLAYGROUND_FILE,
      chats: { [PLAYGROUND_FILE]: createChatState() },
      thinkingLevel: 'low',
      thinkingLevels: playgroundThinkingLevels,
      skills: playgroundSkills,
      commands: playgroundCommands,
      running: [playgroundSessions[2]!.path],
      attention: { [playgroundSessions[0]!.path]: 'input', [playgroundSessions[1]!.path]: 'done' },
      contextUsage: playgroundContextUsage,
      send: async () => {},
      listSessions: async () => playgroundSessions,
      switchSession: async () => {},
      respondUi: async (id) => {
        useSession.setState((state) =>
          patchChat(state, PLAYGROUND_FILE, {
            uiRequests: activeChat(state).uiRequests.filter((item) => item.id !== id),
          }),
        )
      },
      retrust: async () => {
        useSession.setState({ trusted: true })
      },
      editMessage: async (timestamp) => {
        const message = activeChat(useSession.getState()).messages.find(
          (item) => item.role === 'user' && item.timestamp === timestamp,
        )
        if (message?.role !== 'user') return
        useSession.setState({
          editing: { sessionFile: PLAYGROUND_FILE, leafId: 'playground-leaf' },
        })
        useSession.getState().fillComposer(userText(message))
      },
      cancelEdit: async () => {
        useSession.setState({ editing: null })
        useSession.getState().fillComposer('')
      },
      forkMessage: async (timestamp) => {
        const message = activeChat(useSession.getState()).messages.find(
          (item) => item.role === 'user' && item.timestamp === timestamp,
        )
        if (message?.role === 'user') useSession.getState().fillComposer(userText(message))
        return true
      },
      retryLast: async () => {},
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
      openFolder: async () => {},
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
      ...TAB_DEFAULTS,
      ...session,
    }))
  }, [model, plan, session])
}

export function Playground() {
  const navigate = useNavigate()
  // In the URL, so a reload stays on the same tab.
  const [params, setParams] = useSearchParams()
  const pane = TABS.find((item) => item.title === params.get('tab')) ?? TABS[1]!
  const scrollerRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<TranscriptHandle>(null)
  // Mock times are relative, so turn timers and dialog countdowns start when the tab opens.
  const [openedAt, setOpenedAt] = useState(() => Date.now())
  const model = useMemo(
    () => ({
      ...pane.model,
      turnStartedAt: pane.agoMs == null ? pane.model.turnStartedAt : openedAt - pane.agoMs,
      uiRequests: pane.model.uiRequests.map((request) =>
        request.expiresAt ? { ...request, expiresAt: openedAt + request.expiresAt } : request,
      ),
    }),
    [pane, openedAt],
  )
  usePlaygroundSession(model, pane.plan, pane.session)
  const chat = useChat()
  const activeModel = chat.messages.length > 0 || chat.steeringQueue.length > 0 ? chat : model

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="app-drag flex h-9 shrink-0 items-center gap-2 overflow-hidden border-b border-border pr-3 pl-20">
        <Select
          value={pane.title}
          onValueChange={(title) => {
            if (!title) return
            setParams({ tab: title }, { replace: true })
            setOpenedAt(Date.now())
          }}
        >
          <SelectTrigger variant="ghost" size="sm" className="app-no-drag" aria-label="Scenario">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {TABS.map((item) => (
              <SelectItem key={item.title} value={item.title}>
                {item.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="app-drag h-full min-w-0 flex-1" />
        <div className="app-no-drag flex shrink-0 items-center gap-1">
          <SessionSwitcher />
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              notify('Review finished: 2 suggestions', 'info')
              notify('Lint reported 2 warnings', 'warning')
              notify('Extension "deploy" failed to load', 'error')
            }}
          >
            Toasts
          </Button>
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
