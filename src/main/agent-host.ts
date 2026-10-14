import {
  type AgentSession,
  type AgentSessionRuntime,
  type CreateAgentSessionRuntimeFactory,
  type ExtensionUIContext,
  type SessionEntry,
  type SessionStartEvent,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  initTheme,
  SessionManager,
  SettingsManager,
  sessionEntryToContextMessages,
} from '@earendil-works/pi-coding-agent'
import {
  getSupportedThinkingLevels,
  type Api,
  type Model,
  type UserMessage,
} from '@earendil-works/pi-ai'
import {
  asThinkingLevel,
  isAgentMessage,
  modelKey,
  parseThinkingLevels,
  type AgentMessage,
  type AskReply,
  type CommandInfo,
  type ContextUsage,
  type MessageRef,
  type ModelInfo,
  type ModelSelection,
  type SessionEvent,
  type SessionEventBody,
  type SessionSnapshot,
  type SessionState,
  type SkillInfo,
  type ThinkingLevel,
  type UiResponse,
} from '@shared/protocol'
import { alignPersistedAt, persistRecordsFromEntries } from '@shared/turns'
import { toSessionEvent } from './agent-events'
import { createAskUser, type AskUser } from './ask-user'
import { createExtensionUi, type ExtensionUi } from './extension-ui'
import { builtinExtensions } from './agent-extensions'
import { readConfig } from './config'
import { createPlanMode, replayPlan, type PlanMode } from './plan-mode'
import { generateSessionTitle } from './session-title'
import { SerialQueue } from '@shared/queue'
import { resolveEnabledModels } from '@shared/settings'

const MODEL_REFRESH_MS = 15_000

// pi's own theme, taken from a session's UI context before Pi Dot's replaces it.
let piTheme: ExtensionUIContext['theme'] | undefined

class LiveSession {
  unsubscribe: (() => void) | null = null
  promptRun: Promise<unknown> | null = null
  titled = false
  readonly ui: ExtensionUi
  /** The `AgentHost.live` key; the runtime may replace the session (a fork) under it. */
  key: string

  constructor(
    readonly runtime: AgentSessionRuntime,
    emit: (event: SessionEventBody) => void,
  ) {
    piTheme ??= runtime.session.extensionRunner.getUIContext().theme
    this.ui = createExtensionUi(emit, () => piTheme!)
    this.key = this.sessionFile
  }

  get session(): AgentSession {
    return this.runtime.session
  }

  get sessionFile(): string {
    return this.session.sessionFile ?? this.session.sessionId
  }
}

export class AgentHost {
  private live = new Map<string, LiveSession>()
  private active: LiveSession | null = null
  private listeners: Array<(event: SessionEvent) => void> = []
  private agentDir: string | null = null
  private createRuntime: CreateAgentSessionRuntimeFactory | null = null
  private ops = new SerialQueue()
  private planModes = new WeakMap<SessionManager, PlanMode>()
  private askUsers = new WeakMap<SessionManager, AskUser>()

  /** `trusted`: whether the project's own extensions, settings and skills load. */
  constructor(
    readonly cwd: string,
    readonly trusted = true,
  ) {}

  onEvent(listener: (event: SessionEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener)
    }
  }

  private emit(event: SessionEvent): void {
    for (const listener of this.listeners) listener(event)
  }

  get activeSessionFile(): string | null {
    return this.active?.sessionFile ?? null
  }

  /** The session's name, else its first message; for notifications. */
  sessionTitle(sessionFile: string): string | undefined {
    const session = this.live.get(sessionFile)?.session
    if (!session) return undefined
    if (session.sessionName) return session.sessionName
    const first = session.messages.find((message) => message.role === 'user')
    const text = first ? messageText(first.content as UserMessage['content']) : ''
    return text ? (text.length > 40 ? `${text.slice(0, 39)}…` : text) : undefined
  }

  /** The text, or error, of the session's last assistant message. */
  lastReply(sessionFile: string): { text: string; error?: string } | undefined {
    const session = this.live.get(sessionFile)?.session
    const last = session?.messages.filter((message) => message.role === 'assistant').at(-1)
    if (last?.role !== 'assistant') return undefined
    const text = last.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join(' ')
      .trim()
    return last.stopReason === 'error' ? { text, error: last.errorMessage ?? 'Error' } : { text }
  }

  runningSessionFiles(): string[] {
    const files: string[] = []
    for (const live of this.live.values()) {
      if (live.promptRun || live.session.isStreaming) files.push(live.sessionFile)
    }
    return files
  }

  async start(): Promise<void> {
    return this.ops.enqueue(async () => {
      if (this.active) throw new Error('Agent already started')

      const agentDir = getAgentDir()
      const settingsManager = SettingsManager.create(this.cwd, agentDir, {
        projectTrusted: this.trusted,
      })
      // As pi's CLI does; extensions color their statuses and widgets with `ctx.ui.theme`.
      // The theme is process-wide, so the last folder started picks it for every window.
      initTheme(settingsManager.getTheme())

      this.agentDir = agentDir
      this.createRuntime = async ({
        cwd,
        agentDir: nextAgentDir,
        sessionManager,
        sessionStartEvent,
      }) => {
        const planMode = createPlanMode()
        this.planModes.set(sessionManager, planMode)
        const askUser = createAskUser()
        this.askUsers.set(sessionManager, askUser)
        const services = await createAgentSessionServices({
          cwd,
          agentDir: nextAgentDir,
          settingsManager: SettingsManager.create(cwd, nextAgentDir, {
            projectTrusted: this.trusted,
          }),
          modelRuntimeSignal: AbortSignal.timeout(MODEL_REFRESH_MS),
          resourceLoaderOptions: {
            extensionFactories: [
              ...builtinExtensions,
              { name: 'plan-mode', factory: planMode.extension, builtin: true },
              { name: 'ask-user', factory: askUser.extension, builtin: true },
            ],
          },
        })
        return {
          ...(await createAgentSessionFromServices({
            services,
            sessionManager,
            sessionStartEvent,
            // Pi Dot enables codemode by default; an explicit `defaultTools` setting still wins.
            tools:
              services.settingsManager.getDefaultTools() === undefined ? ['+codemode'] : undefined,
          })),
          services,
          diagnostics: services.diagnostics,
        }
      }

      const live = await this.createLive(
        SessionManager.create(this.cwd, settingsManager.getSessionDir()),
      )
      this.live.set(live.key, live)
      this.active = live
    })
  }

  async stop(): Promise<void> {
    return this.ops.enqueue(async () => {
      const sessions = [...this.live.values()]
      this.live.clear()
      this.active = null
      this.createRuntime = null
      this.agentDir = null
      await Promise.all(sessions.map((session) => this.disposeLive(session)))
    })
  }

  /** `message` is the user's approval, which may carry comments on the plan. */
  async approvePlan(sessionFile: string | undefined, message: string): Promise<void> {
    await this.prompt(message, sessionFile, false, true)
  }

  async respondUi(sessionFile: string, id: string, response: UiResponse): Promise<void> {
    if (!this.requireActive(sessionFile).ui.respond(id, response)) {
      throw new Error('No extension dialog is waiting')
    }
  }

  async answerQuestion(sessionFile: string, toolCallId: string, reply: AskReply): Promise<void> {
    const live = this.requireActive(sessionFile)
    if (!this.askUsers.get(live.session.sessionManager)?.answer(toolCallId, reply)) {
      throw new Error('No question is waiting for an answer')
    }
  }

  async prompt(
    message: string,
    sessionFile?: string,
    planMode = false,
    approved = false,
  ): Promise<void> {
    const live = this.requireActive(sessionFile)
    const session = live.session
    this.planModes.get(session.sessionManager)?.setNext(planMode, approved)
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const succeed = () => {
        if (settled) return
        settled = true
        resolve()
      }
      const fail = (error: unknown) => {
        if (settled) return
        settled = true
        reject(error instanceof Error ? error : new Error(String(error)))
      }
      const run = session.prompt(message, {
        source: 'rpc',
        preflightResult: succeed,
      })
      live.promptRun = run
      // The SDK can resolve without a preflight (a prompt deferred until the agent settles).
      void run.then(succeed, fail).finally(() => {
        if (live.promptRun === run) live.promptRun = null
        void this.ops.enqueue(async () => {
          await this.discardIfUnused(live)
        })
      })
    })
  }

  async steer(message: string, sessionFile?: string): Promise<void> {
    await this.ops.enqueue(async () => {
      const live = this.requireActive(sessionFile)
      if (!live.session.isStreaming) throw new Error('Session is not streaming')
      await live.session.steer(message)
    })
  }

  async removeSteering(index: number, sessionFile?: string): Promise<void> {
    await this.ops.enqueue(async () => {
      const live = this.requireActive(sessionFile)
      const session = live.session
      const messages = [...session.getSteeringMessages()]
      if (!Number.isInteger(index) || index < 0 || index >= messages.length) return
      await this.replaceSteeringQueue(
        session,
        messages.filter((_, itemIndex) => itemIndex !== index),
      )
    })
  }

  async followUp(message: string, sessionFile?: string): Promise<void> {
    await this.ops.enqueue(async () => {
      const live = this.requireActive(sessionFile)
      if (!live.session.isStreaming) throw new Error('Session is not streaming')
      await live.session.followUp(message)
    })
  }

  async setFollowUpQueue(messages: string[], sessionFile?: string): Promise<void> {
    await this.ops.enqueue(async () => {
      const live = this.requireActive(sessionFile)
      await this.replaceFollowUpQueue(live.session, messages)
    })
  }

  async promoteFollowUp(index: number, sessionFile?: string): Promise<void> {
    await this.ops.enqueue(async () => {
      const live = this.requireActive(sessionFile)
      const session = live.session
      if (!session.isStreaming) throw new Error('Session is not streaming')
      const previous = [...session.getFollowUpMessages()]
      const text = previous[index]
      if (text === undefined) return
      const next = previous.filter((_, itemIndex) => itemIndex !== index)
      await this.replaceFollowUpQueue(session, next)
      try {
        await session.steer(text)
      } catch (error) {
        await this.replaceFollowUpQueue(session, previous)
        throw error
      }
    })
  }

  async clearQueue(sessionFile?: string): Promise<{ steering: string[]; followUp: string[] }> {
    return this.ops.enqueue(async () => this.requireActive(sessionFile).session.clearQueue())
  }

  async clearSteeringQueue(sessionFile?: string): Promise<void> {
    await this.ops.enqueue(async () => {
      const live = this.requireActive(sessionFile)
      await this.replaceSteeringQueue(live.session, [])
    })
  }

  async abort(sessionFile?: string): Promise<void> {
    await this.ops.enqueue(async () => {
      const live = this.requireActive(sessionFile)
      live.session.clearQueue()
      await live.session.abort()
    })
  }

  /**
   * Rewinds the session to just before the user message sent at `timestamp`, for its edit to be
   * sent instead. The old branch stays in the file.
   */
  async editMessage(sessionFile: string, timestamp: number): Promise<SessionSnapshot> {
    return this.ops.enqueue(async () => {
      const session = this.requireIdle(sessionFile).session
      const result = await session.navigateTree(
        messageEntryId(session, { role: 'user', timestamp }),
      )
      if (result.cancelled) throw new Error('An extension cancelled the edit')
      return this.snapshot()
    })
  }

  /** Names the session; the change reaches the renderer as a `session_name` event. */
  renameSession(sessionFile: string, name: string): void {
    this.requireActive(sessionFile).session.setSessionName(name)
  }

  /** Whether the user message sent at `timestamp` was sent in plan mode. */
  messagePlanMode(sessionFile: string, timestamp: number): boolean {
    const branch = this.requireActive(sessionFile).session.sessionManager.getBranch()
    // A run's mode entry lands before its user message, and only when the mode changes.
    return replayPlan(branch.slice(0, messageEntryIndex(branch, { role: 'user', timestamp })))
      .active
  }

  /**
   * Rewinds the session to a user message, dropping what followed it, or through the end of the
   * turn holding any other message. The old branch stays in the file; `leafId` returns there.
   */
  async rewindMessage(
    sessionFile: string,
    message: MessageRef,
  ): Promise<{ snapshot: SessionSnapshot; leafId: string | null }> {
    return this.ops.enqueue(async () => {
      const session = this.requireIdle(sessionFile).session
      const leafId = session.sessionManager.getLeafId()
      if (message.role === 'user') {
        // `navigateTree` would stop before a user message, handing its text to the Composer.
        session.sessionManager.branch(messageEntryId(session, message))
        session.refreshContext()
      } else {
        const result = await session.navigateTree(turnEndEntryId(session, message))
        if (result.cancelled) throw new Error('An extension cancelled the rewind')
      }
      return { snapshot: this.snapshot(), leafId }
    })
  }

  /** Returns from a rewind to the branch it left. */
  async restoreLeaf(sessionFile: string, leafId: string): Promise<SessionSnapshot> {
    return this.ops.enqueue(async () => {
      await this.requireIdle(sessionFile).session.navigateTree(leafId)
      return this.snapshot()
    })
  }

  /**
   * Starts a new session before a user message, whose text comes back for the Composer, or
   * through the end of the turn holding any other message.
   */
  async forkMessage(
    sessionFile: string,
    message: MessageRef,
  ): Promise<{ snapshot: SessionSnapshot; text: string }> {
    return this.ops.enqueue(async () => {
      const live = this.requireIdle(sessionFile)
      const result =
        message.role === 'user'
          ? await live.runtime.fork(messageEntryId(live.session, message), { position: 'before' })
          : await live.runtime.fork(turnEndEntryId(live.session, message), { position: 'at' })
      if (result.cancelled) throw new Error('An extension cancelled the fork')
      return { snapshot: this.snapshot(), text: result.selectedText ?? '' }
    })
  }

  private requireIdle(sessionFile: string): LiveSession {
    const live = this.requireActive(sessionFile)
    if (live.promptRun || live.session.isStreaming) throw new Error('Session is running')
    return live
  }

  async compact(sessionFile?: string): Promise<void> {
    await this.requireActive(sessionFile).session.compact()
  }

  private async replaceSteeringQueue(session: AgentSession, messages: string[]): Promise<void> {
    const previous = [...session.getSteeringMessages()]
    const target = session as unknown as {
      _steeringMessages: string[]
      _emitQueueUpdate?: () => void
    }
    try {
      session.agent.clearSteeringQueue()
      target._steeringMessages = []
      if (messages.length === 0) target._emitQueueUpdate?.()
      for (const text of messages) {
        await session.steer(text)
      }
    } catch (error) {
      session.agent.clearSteeringQueue()
      target._steeringMessages = []
      if (previous.length === 0) target._emitQueueUpdate?.()
      for (const text of previous) {
        await session.steer(text)
      }
      throw error
    }
  }

  private async replaceFollowUpQueue(session: AgentSession, messages: string[]): Promise<void> {
    const previous = [...session.getFollowUpMessages()]
    const target = session as unknown as {
      _followUpMessages: string[]
      _emitQueueUpdate?: () => void
    }
    try {
      session.agent.clearFollowUpQueue()
      target._followUpMessages = []
      for (const text of messages) {
        await session.followUp(text)
      }
      if (messages.length === 0) target._emitQueueUpdate?.()
    } catch (error) {
      session.agent.clearFollowUpQueue()
      target._followUpMessages = []
      for (const text of previous) {
        await session.followUp(text)
      }
      if (previous.length === 0) target._emitQueueUpdate?.()
      throw error
    }
  }

  private getState(): SessionState {
    const session = this.session
    const planMode = this.planModes.get(session.sessionManager)
    return {
      model: session.model ? toModelInfo(session.model) : null,
      thinkingLevel: asThinkingLevel(session.thinkingLevel) ?? 'off',
      isStreaming: session.isStreaming,
      sessionFile: session.sessionFile,
      sessionId: session.sessionId,
      sessionName: session.sessionName,
      messageCount: session.messages.length,
      steeringQueue: [...session.getSteeringMessages()],
      followUpQueue: [...session.getFollowUpMessages()],
      planMode: planMode?.active ?? false,
      plan: planMode?.plan ?? null,
    }
  }

  private getMessages(): AgentMessage[] {
    return this.session.messages.filter(isAgentMessage) as AgentMessage[]
  }

  private getMessagePersistedAt(): number[] {
    const messages = this.getMessages()
    return alignPersistedAt(
      messages,
      persistRecordsFromEntries(this.session.sessionManager.getBranch()),
    )
  }

  private getAvailableModels(): ModelInfo[] {
    const current = this.session.model
    const available = this.session.modelRuntime.getAvailableSnapshot()
    const patterns = this.session.settingsManager.getEnabledModels()
    const enabled = patterns?.length ? resolveEnabledModels(patterns, available) : null
    return available
      .filter(
        (item) =>
          !enabled ||
          enabled.has(modelKey(item)) ||
          (item.provider === current?.provider && item.id === current.id),
      )
      .map(toModelInfo)
  }

  private getAvailableThinkingLevels(): ThinkingLevel[] {
    return parseThinkingLevels(this.session.getAvailableThinkingLevels())
  }

  private getSkills(): SkillInfo[] {
    return this.session.resourceLoader.getSkills().skills.map((skill) => ({
      name: skill.name,
      ...(skill.description ? { description: skill.description } : {}),
    }))
  }

  private getCommands(): CommandInfo[] {
    const session = this.session
    return [
      ...session.extensionRunner.getRegisteredCommands().map((command): CommandInfo => ({
        name: command.invocationName,
        ...(command.description ? { description: command.description } : {}),
        source: 'extension',
      })),
      ...session.promptTemplates.map((template): CommandInfo => ({
        name: template.name,
        ...(template.description ? { description: template.description } : {}),
        source: 'prompt',
      })),
    ]
  }

  private getContextUsage(): ContextUsage | null {
    return toContextUsage(this.session)
  }

  snapshot(): SessionSnapshot {
    return {
      cwd: this.cwd,
      state: this.getState(),
      messages: this.getMessages(),
      messagePersistedAt: this.getMessagePersistedAt(),
      models: this.getAvailableModels(),
      thinkingLevels: this.getAvailableThinkingLevels(),
      runningSessionFiles: this.runningSessionFiles(),
      skills: this.getSkills(),
      commands: this.getCommands(),
      trusted: this.trusted,
      ui: this.requireActive().ui.snapshot(),
      contextUsage: this.getContextUsage(),
      steeringQueue: [...this.session.getSteeringMessages()],
      followUpQueue: [...this.session.getFollowUpMessages()],
    }
  }

  async setModel(provider: string, modelId: string): Promise<ModelSelection> {
    const model = this.session.modelRuntime
      .getAvailableSnapshot()
      .find((item) => item.provider === provider && item.id === modelId)
    if (!model) throw new Error(`Model not found: ${provider}/${modelId}`)
    await this.session.setModel(model)
    this.emitContextUsage(this.requireActive())
    return this.getModelSelection()
  }

  async setThinkingLevel(level: ThinkingLevel): Promise<ModelSelection> {
    this.session.setThinkingLevel(level)
    return this.getModelSelection()
  }

  async refreshModels(): Promise<void> {
    const live = this.active
    if (!live) return
    await live.session.modelRuntime.refresh({ signal: AbortSignal.timeout(MODEL_REFRESH_MS) })
  }

  async reloadSettings(): Promise<void> {
    const live = this.active
    if (!live) return
    const settings = live.session.settingsManager
    await settings.reload()
    live.session.agent.steeringMode = settings.getSteeringMode()
    live.session.agent.followUpMode = settings.getFollowUpMode()
    live.session.setAutoCompactionEnabled(settings.getCompactionEnabled())
    live.session.setAutoRetryEnabled(settings.getRetryEnabled())
  }

  async switchSession(sessionPath: string): Promise<SessionSnapshot> {
    return this.ops.enqueue(async () => {
      if (this.requireActive().sessionFile === sessionPath) return this.snapshot()

      const existing = this.live.get(sessionPath)
      const previous = this.requireActive()
      if (existing) {
        this.active = existing
        await this.discardIfUnused(previous)
        return this.snapshot()
      }

      const next = await this.createLive(
        SessionManager.open(sessionPath, previous.session.sessionManager.getSessionDir(), this.cwd),
        { type: 'session_start', reason: 'resume', previousSessionFile: previous.sessionFile },
      )
      this.live.set(next.key, next)
      this.active = next
      await this.discardIfUnused(previous)
      return this.snapshot()
    })
  }

  async newSession(): Promise<SessionSnapshot> {
    return this.ops.enqueue(async () => {
      const previous = this.requireActive()
      if (!previous.promptRun && previous.session.messages.length === 0) {
        return this.snapshot()
      }
      const next = await this.createLive(
        SessionManager.create(this.cwd, previous.session.sessionManager.getSessionDir()),
        {
          type: 'session_start',
          reason: 'new',
          previousSessionFile: previous.sessionFile,
        },
      )
      this.live.set(next.key, next)
      this.active = next
      await this.discardIfUnused(previous)
      return this.snapshot()
    })
  }

  private get session(): AgentSession {
    return this.requireActive().session
  }

  private requireActive(sessionFile?: string): LiveSession {
    if (sessionFile) {
      const match = this.live.get(sessionFile)
      if (match) return match
    }
    if (!this.active) throw new Error('No active session')
    if (sessionFile && this.active.sessionFile !== sessionFile) {
      throw new Error('Session changed')
    }
    return this.active
  }

  private getModelSelection(): ModelSelection {
    const state = this.getState()
    return {
      model: state.model ?? { id: '', name: 'unknown', provider: '' },
      thinkingLevel: state.thinkingLevel,
      thinkingLevels: this.getAvailableThinkingLevels(),
    }
  }

  private async createLive(
    sessionManager: SessionManager,
    sessionStartEvent?: SessionStartEvent,
  ): Promise<LiveSession> {
    const createRuntime = this.createRuntime
    const agentDir = this.agentDir
    if (!createRuntime || !agentDir) throw new Error('Agent is not started')

    const runtime = await createAgentSessionRuntime(createRuntime, {
      cwd: this.cwd,
      agentDir,
      sessionManager,
      sessionStartEvent,
    })

    const errors = runtime.diagnostics.filter((item) => item.type === 'error')
    if (errors.length > 0) {
      await runtime.dispose()
      throw new Error(errors.map((item) => item.message).join('\n'))
    }

    const live: LiveSession = new LiveSession(runtime, (body) =>
      this.emit({ ...body, sessionFile: live.sessionFile } as SessionEvent),
    )
    // A fork or an extension's session switch replaces the session inside the runtime.
    runtime.setRebindSession(async () => {
      if (this.live.get(live.key) === live) this.live.delete(live.key)
      live.key = live.sessionFile
      this.live.set(live.key, live)
      await this.bindSession(live)
    })

    try {
      await this.bindSession(live)
    } catch (error) {
      await runtime.dispose()
      throw error
    }

    void runtime.session.modelRuntime
      .refresh({ signal: AbortSignal.timeout(MODEL_REFRESH_MS) })
      .catch((error: unknown) => {
        console.error('Failed to refresh model runtime', error)
      })

    return live
  }

  private async discardIfUnused(live: LiveSession): Promise<void> {
    if (live === this.active) return
    if (live.promptRun) return
    if (this.live.get(live.key) !== live) return
    this.live.delete(live.key)
    await this.disposeLive(live)
  }

  private async disposeLive(live: LiveSession): Promise<void> {
    live.unsubscribe?.()
    live.unsubscribe = null
    live.ui.dispose()
    try {
      await live.runtime.session.abort()
    } catch (error) {
      console.error('Failed to abort session during dispose', error)
    }
    await live.runtime.dispose()
  }

  private async bindSession(live: LiveSession): Promise<void> {
    const session = live.session
    live.unsubscribe?.()
    await session.bindExtensions({
      uiContext: live.ui.context,
      mode: 'rpc',
      commandContextActions: {
        waitForIdle: () => session.waitForIdle(),
        newSession: async () => {
          await this.newSession()
          return { cancelled: false }
        },
        fork: async (entryId, options) => {
          const result = await live.runtime.fork(entryId, options)
          return { cancelled: result.cancelled }
        },
        navigateTree: async (targetId, options) => {
          const result = await session.navigateTree(targetId, options)
          return { cancelled: result.cancelled }
        },
        switchSession: async (sessionPath) => {
          await this.switchSession(sessionPath)
          return { cancelled: false }
        },
        reload: () => session.reload(),
      },
      // As pi's TUI does; otherwise an extension that throws fails silently.
      onError: ({ extensionPath, event, error }) => {
        this.emit({
          type: 'extension_error',
          sessionFile: live.sessionFile,
          extensionPath,
          event,
          message: error,
        })
      },
    })
    const planMode = this.planModes.get(session.sessionManager)
    const unsubscribePlan = planMode?.onChange(({ active, plan }) => {
      this.emit({ type: 'plan_mode', sessionFile: live.sessionFile, active, plan })
    })
    const unsubscribeSession = session.subscribe((event) => {
      const mapped = toSessionEvent(event, live.sessionFile)
      if (mapped) this.emit(mapped)
      if (event.type === 'message_end' && event.message.role === 'user') {
        this.autoGenerateTitle(live, event.message.content)
      }
      if (
        event.type === 'agent_end' ||
        event.type === 'compaction_start' ||
        event.type === 'compaction_end'
      ) {
        this.emitContextUsage(live)
      }
    })
    live.unsubscribe = () => {
      unsubscribeSession()
      unsubscribePlan?.()
    }
  }

  private autoGenerateTitle(live: LiveSession, content: UserMessage['content']): void {
    const session = live.session
    if (live.titled || session.sessionName) return
    live.titled = true
    const { enabled, model } = readConfig().autoGenerateSessionTitle
    if (!enabled) return
    const text = messageText(content)
    if (!text) return
    void generateSessionTitle(session, text, model)
      .then((title) => {
        if (title && !session.sessionName) session.setSessionName(title)
      })
      .catch((error: unknown) => {
        console.error('Failed to generate session title', error)
      })
  }

  private emitContextUsage(live: LiveSession): void {
    this.emit({
      type: 'context_usage',
      sessionFile: live.sessionFile,
      usage: toContextUsage(live.session),
    })
  }
}

function messageText(content: UserMessage['content']): string {
  if (typeof content === 'string') return content.trim()
  return content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('\n')
    .trim()
}

function toContextUsage(session: AgentSession): ContextUsage | null {
  const usage = session.getContextUsage()
  if (!usage) return null
  const { tokens, cost } = session.getSessionStats()
  return {
    tokens: usage.tokens,
    contextWindow: usage.contextWindow,
    percent: usage.percent,
    session: {
      input: tokens.input,
      output: tokens.output,
      cacheRead: tokens.cacheRead,
      cacheWrite: tokens.cacheWrite,
      cost,
    },
    compacting: session.isCompacting,
  }
}

function toModelInfo(model: Model<Api>): ModelInfo {
  return {
    id: String(model.id ?? ''),
    name: String(model.name || model.id || 'unknown'),
    provider: String(model.provider ?? ''),
    thinkingLevels: parseThinkingLevels(getSupportedThinkingLevels(model)),
  }
}

function messageEntryIndex(branch: SessionEntry[], { role, timestamp }: MessageRef): number {
  const index = branch.findIndex((entry) =>
    sessionEntryToContextMessages(entry).some(
      (message) => message.role === role && message.timestamp === timestamp,
    ),
  )
  if (index < 0) throw new Error('Message not found in this session')
  return index
}

function messageEntryId(session: AgentSession, message: MessageRef): string {
  const branch = session.sessionManager.getBranch()
  return branch[messageEntryIndex(branch, message)]!.id
}

/** The last entry before the next user message, so the turn's unshown entries come along. */
function turnEndEntryId(session: AgentSession, message: MessageRef): string {
  const branch = session.sessionManager.getBranch()
  const start = messageEntryIndex(branch, message)
  const next = branch.findIndex(
    (entry, index) => index > start && entry.type === 'message' && entry.message.role === 'user',
  )
  return branch[next < 0 ? branch.length - 1 : next - 1]!.id
}
