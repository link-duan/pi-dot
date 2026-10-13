import { PATH, router } from '@/router'
import { loadSettings, useSettings } from '@/settings/store'
import { applyLiveSnapshot, useSession } from '@/session/store'
import { activeChat, applyEvent } from '@/session/state'
import type { AgentMessage, ConnectionStatus, SessionEvent } from '@shared/protocol'

let bound = false
const pendingUpdates = new Map<string, SessionEvent>()
let raf = 0
const buffer = createReplayBuffer<Queued>()

type Queued =
  | { kind: 'event'; event: SessionEvent }
  | { kind: 'status'; status: ConnectionStatus; error?: string }

export function createReplayBuffer<T>() {
  let open = false
  const items: T[] = []
  return {
    push(item: T, deliver: (item: T) => void) {
      if (open) deliver(item)
      else items.push(item)
    },
    flush(deliver: (item: T) => void) {
      open = true
      const batch = items.splice(0)
      for (const item of batch) deliver(item)
    },
  }
}

export function replayQueuedEvent(
  event: SessionEvent,
  ctx: { sessionFile: string | null; isStreaming: boolean; lastMessage?: AgentMessage },
): SessionEvent | null {
  if (event.type === 'agent_start' && event.sessionFile === ctx.sessionFile && ctx.isStreaming) {
    return null
  }
  if (
    event.type === 'message_start' &&
    event.message &&
    event.sessionFile === ctx.sessionFile &&
    ctx.lastMessage?.role === event.message.role &&
    ctx.lastMessage.timestamp === event.message.timestamp
  ) {
    return { ...event, type: 'message_update' }
  }
  return event
}

export function resolveQueuedStatus(
  status: ConnectionStatus,
  cwd: string | null,
): 'attach' | 'ignore' | 'apply' {
  if (status === 'ready' && !cwd) return 'attach'
  if (cwd && (status === 'connecting' || status === 'ready')) return 'ignore'
  return 'apply'
}

function dispatch(event: SessionEvent): void {
  useSession.setState((state) => applyEvent(state, event))
}

function flushPending(sessionFile: string): void {
  const queued = pendingUpdates.get(sessionFile)
  if (!queued) return
  pendingUpdates.delete(sessionFile)
  dispatch(queued)
}

async function attachLiveSession(): Promise<void> {
  const snapshot = await window.pi.getSnapshot()
  if (snapshot) applyLiveSnapshot(snapshot)
}

function applyStatus(status: ConnectionStatus, error?: string): void {
  const action = resolveQueuedStatus(status, useSession.getState().cwd)
  if (action === 'attach') {
    void attachLiveSession()
    return
  }
  if (action === 'ignore') return
  useSession.setState({ connection: status, error: error ?? null })
}

function onLiveEvent(event: SessionEvent): void {
  if (event.type === 'message_update') {
    pendingUpdates.set(event.sessionFile, event)
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0
        const queued = [...pendingUpdates.values()]
        pendingUpdates.clear()
        for (const item of queued) dispatch(item)
      })
    }
    return
  }
  flushPending(event.sessionFile)
  dispatch(event)
  const session = useSession.getState()
  if (event.sessionFile === session.sessionFile && event.type === 'ui_editor_text') {
    session.fillComposer(event.text)
  }
  // The agent may have just edited the plan; keep a viewer opened mid-run current.
  if (
    event.type === 'tool_execution_end' &&
    event.sessionFile === session.sessionFile &&
    activeChat(session).planActive
  ) {
    void session.refreshPlan()
  }
  if (
    event.type === 'agent_end' &&
    !event.willRetry &&
    event.sessionFile === session.sessionFile &&
    activeChat(session).planActive
  ) {
    void session.refreshPlan(true)
  }
}

function deliverQueued(item: Queued): void {
  if (item.kind === 'status') {
    applyStatus(item.status, item.error)
    return
  }
  const session = useSession.getState()
  const chat = activeChat(session)
  const event = replayQueuedEvent(item.event, {
    sessionFile: session.sessionFile,
    isStreaming: chat.isStreaming,
    lastMessage: chat.messages.at(-1),
  })
  if (event) dispatch(event)
}

export function bindIpc(): void {
  if (bound) return
  bound = true

  window.pi.onEvent((event) => {
    buffer.push({ kind: 'event', event }, (item) => {
      if (item.kind === 'event') onLiveEvent(item.event)
    })
  })

  // Keep the Plan File in sync as the toggle flips, sessions switch, or it is edited outside.
  useSession.subscribe((state, prev) => {
    if (
      state.sessionFile !== prev.sessionFile ||
      activeChat(state).planMode !== activeChat(prev).planMode ||
      activeChat(state).plan?.path !== activeChat(prev).plan?.path ||
      activeChat(state).plan?.built !== activeChat(prev).plan?.built
    ) {
      void state.refreshPlan()
    }
  })
  window.addEventListener('focus', () => void useSession.getState().refreshPlan())

  window.pi.onStatus((status, error) => {
    buffer.push({ kind: 'status', status, error }, (item) => {
      if (item.kind === 'status') applyStatus(item.status, item.error)
    })
  })

  window.pi.onCommand((command, arg) => {
    if (command === 'switchSession' && arg) {
      if (router.state.location.pathname !== PATH.session) void router.navigate(PATH.session)
      void useSession.getState().switchSession(arg)
    }
    if (command === 'newSession') {
      void useSession
        .getState()
        .newSession()
        .then(() => useSession.getState().requestComposerFocus())
    }
    if (command === 'openSettings' && router.state.location.pathname !== PATH.settings) {
      void router.navigate(PATH.settings)
    }
    if (command === 'openPlayground' && router.state.location.pathname !== PATH.playground) {
      void router.navigate(PATH.playground)
    }
    if (command === 'reloadSettings') void reloadSettings()
    if (command === 'reloadSnapshot') void reloadSnapshot()
  })
}

async function reloadSettings(): Promise<void> {
  await loadSettings()
  useSettings.getState().bump()
}

async function reloadSnapshot(): Promise<void> {
  const snapshot = await window.pi.getSnapshot()
  if (snapshot) applyLiveSnapshot(snapshot)
  await loadSettings()
  useSettings.getState().bump()
  useSettings.getState().bumpCatalog()
}

export function releaseIpcQueue(): void {
  buffer.flush(deliverQueued)
}
