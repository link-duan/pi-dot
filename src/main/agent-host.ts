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
  asThinkingLevel,
  isAgentMessage,
  parseThinkingLevels,
  type AgentMessage,
  type ContextUsage,
  type ModelInfo,
  type ModelSelection,
  type SessionEvent,
  type SessionState,
  type SkillInfo,
  type ThinkingLevel,
} from '@shared/protocol'
import { alignPersistedAt, persistRecordsFromEntries } from '@shared/turns'
import { toSessionEvent } from './agent-events'

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
  private op: Promise<unknown> = Promise.resolve()

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
    return this.enqueue(async () => {
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
        })
        return {
          ...(await createAgentSessionFromServices({
            services,
            sessionManager,
            sessionStartEvent,
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
    return this.enqueue(async () => {
      const sessions = [...this.live.values()]
      this.live.clear()
      this.active = null
      this.createRuntime = null
      this.agentDir = null
      await Promise.all(sessions.map((session) => this.disposeLive(session)))
    })
  }

  async prompt(message: string): Promise<void> {
    const live = this.requireActive()
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
        preflightResult: (ok) => {
          if (ok) succeed()
          else fail(new Error('Prompt rejected'))
        },
      })
      live.promptRun = run
      void run.finally(() => {
        if (live.promptRun === run) live.promptRun = null
        void this.enqueue(async () => {
          await this.discardIfUnused(live)
        })
      })
      void run.catch(fail)
    })
  }

  async abort(): Promise<void> {
    await this.session.abort()
  }

  getState(): SessionState {
    const session = this.session
    return {
      model: session.model ? toModelInfo(session.model) : null,
      thinkingLevel: asThinkingLevel(session.thinkingLevel) ?? 'off',
      isStreaming: session.isStreaming,
      sessionFile: session.sessionFile,
      sessionId: session.sessionId,
      messageCount: session.messages.length,
    }
  }

  getMessages(): AgentMessage[] {
    return this.session.messages.filter(isAgentMessage) as AgentMessage[]
  }

  getMessagePersistedAt(): number[] {
    const messages = this.getMessages()
    return alignPersistedAt(
      messages,
      persistRecordsFromEntries(this.session.sessionManager.getBranch()),
    )
  }

  getAvailableModels(): ModelInfo[] {
    return this.session.modelRuntime.getAvailableSnapshot().map(toModelInfo)
  }

  getAvailableThinkingLevels(): ThinkingLevel[] {
    return parseThinkingLevels(this.session.getAvailableThinkingLevels())
  }

  getSkills(): SkillInfo[] {
    return this.session.resourceLoader.getSkills().skills.map((skill) => ({
      name: skill.name,
      ...(skill.description ? { description: skill.description } : {}),
    }))
  }

  getContextUsage(): ContextUsage | null {
    return toContextUsage(this.session.getContextUsage())
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

  async switchSession(sessionPath: string): Promise<{ cancelled: boolean }> {
    return this.enqueue(async () => {
      if (this.requireActive().sessionFile === sessionPath) return { cancelled: false }

      const existing = this.live.get(sessionPath)
      const previous = this.requireActive()
      if (existing) {
        this.active = existing
        await this.discardIfUnused(previous)
        return { cancelled: false }
      }

      const next = await this.createLive(
        SessionManager.open(sessionPath, previous.session.sessionManager.getSessionDir(), this.cwd),
        { type: 'session_start', reason: 'resume', previousSessionFile: previous.sessionFile },
      )
      this.live.set(next.sessionFile, next)
      this.active = next
      await this.discardIfUnused(previous)
      return { cancelled: false }
    })
  }

  async newSession(): Promise<{ cancelled: boolean }> {
    return this.enqueue(async () => {
      const previous = this.requireActive()
      if (!previous.promptRun && previous.session.messages.length === 0) {
        return { cancelled: false }
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
      return { cancelled: false }
    })
  }

  private get session(): AgentSession {
    return this.requireActive().session
  }

  private requireActive(): LiveSession {
    if (!this.active) throw new Error('No active session')
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

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.op.then(fn, fn)
    this.op = run.then(
      () => undefined,
      () => undefined,
    )
    return run
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
      .catch(() => {})

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
    } catch {
      // still dispose
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
        newSession: () => this.newSession(),
        fork: async (entryId, options) => {
          const result = await live.runtime.fork(entryId, options)
          return { cancelled: result.cancelled }
        },
        navigateTree: async (targetId, options) => {
          const result = await session.navigateTree(targetId, options)
          return { cancelled: result.cancelled }
        },
        switchSession: (sessionPath) => this.switchSession(sessionPath),
        reload: () => session.reload(),
      },
    })
    live.unsubscribe = session.subscribe((event) => {
      const mapped = toSessionEvent(event, live.sessionFile)
      if (mapped) this.emit(mapped)
      if (event.type === 'agent_end' || event.type === 'compaction_end') {
        this.emitContextUsage(live)
      }
    })
  }

  private emitContextUsage(live: LiveSession): void {
    this.emit({
      type: 'context_usage',
      sessionFile: live.sessionFile,
      usage: toContextUsage(live.session.getContextUsage()),
    })
  }
}

function toContextUsage(
  usage: { tokens: number | null; contextWindow: number; percent: number | null } | undefined,
): ContextUsage | null {
  if (!usage) return null
  return {
    tokens: usage.tokens,
    contextWindow: usage.contextWindow,
    percent: usage.percent,
  }
}

function toModelInfo(model: { id?: string; name?: string; provider?: string }): ModelInfo {
  return {
    id: String(model.id ?? ''),
    name: String(model.name || model.id || 'unknown'),
    provider: String(model.provider ?? ''),
  }
}
