import {
  type AgentSession,
  type AgentSessionRuntime,
  type CreateAgentSessionRuntimeFactory,
  type SessionStartEvent,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  hasTrustRequiringProjectResources,
  ProjectTrustStore,
  SessionManager,
  SettingsManager,
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
  parseThinkingLevels,
  type AgentMessage,
  type ContextUsage,
  type ModelInfo,
  type ModelSelection,
  type SessionEvent,
  type SessionSnapshot,
  type SessionState,
  type SkillInfo,
  type ThinkingLevel,
} from '@shared/protocol'
import { alignPersistedAt, persistRecordsFromEntries } from '@shared/turns'
import { toSessionEvent } from './agent-events'
import { builtinExtensions } from './agent-extensions'
import { readConfig } from './config'
import { generateSessionTitle } from './session-title'
import { SerialQueue } from '@shared/queue'

const MODEL_REFRESH_MS = 15_000

export function isProjectTrusted(cwd: string, agentDir: string): boolean {
  if (!hasTrustRequiringProjectResources(cwd)) return true
  const saved = new ProjectTrustStore(agentDir).get(cwd)
  if (saved !== null) return saved
  const settings = SettingsManager.create(cwd, agentDir, { projectTrusted: false })
  return settings.getDefaultProjectTrust() === 'always'
}

class LiveSession {
  unsubscribe: (() => void) | null = null
  promptRun: Promise<unknown> | null = null
  titled = false

  constructor(readonly runtime: AgentSessionRuntime) {}

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

  constructor(readonly cwd: string) {}

  onEvent(listener: (event: SessionEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener)
    }
  }

  private emit(event: SessionEvent): void {
    for (const listener of this.listeners) listener(event)
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
      const projectTrusted = isProjectTrusted(this.cwd, agentDir)
      const settingsManager = SettingsManager.create(this.cwd, agentDir, { projectTrusted })

      this.agentDir = agentDir
      this.createRuntime = async ({
        cwd,
        agentDir: nextAgentDir,
        sessionManager,
        sessionStartEvent,
      }) => {
        const trusted = isProjectTrusted(cwd, nextAgentDir)
        const services = await createAgentSessionServices({
          cwd,
          agentDir: nextAgentDir,
          settingsManager: SettingsManager.create(cwd, nextAgentDir, { projectTrusted: trusted }),
          modelRuntimeSignal: AbortSignal.timeout(MODEL_REFRESH_MS),
          resourceLoaderOptions: { extensionFactories: builtinExtensions },
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
      this.live.set(live.sessionFile, live)
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

  async prompt(message: string, sessionFile?: string): Promise<void> {
    const live = this.requireActive(sessionFile)
    const session = live.session
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
    return {
      model: session.model ? toModelInfo(session.model) : null,
      thinkingLevel: asThinkingLevel(session.thinkingLevel) ?? 'off',
      isStreaming: session.isStreaming,
      sessionFile: session.sessionFile,
      sessionId: session.sessionId,
      messageCount: session.messages.length,
      steeringQueue: [...session.getSteeringMessages()],
      followUpQueue: [...session.getFollowUpMessages()],
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
    return this.session.modelRuntime.getAvailableSnapshot().map(toModelInfo)
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
      this.live.set(next.sessionFile, next)
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
      this.live.set(next.sessionFile, next)
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

    const live = new LiveSession(runtime)
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
    if (this.live.get(live.sessionFile) !== live) return
    this.live.delete(live.sessionFile)
    await this.disposeLive(live)
  }

  private async disposeLive(live: LiveSession): Promise<void> {
    live.unsubscribe?.()
    live.unsubscribe = null
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
    })
    live.unsubscribe = session.subscribe((event) => {
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
