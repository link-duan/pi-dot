import {
  type AgentSession,
  type AgentSessionRuntime,
  type CreateAgentSessionRuntimeFactory,
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
  type ModelInfo,
  type ModelSelection,
  type SessionEvent,
  type SessionState,
  type ThinkingLevel,
} from '@shared/protocol'
import { toSessionEvent } from './agent-events'

const MODEL_REFRESH_MS = 15_000

export function isProjectTrusted(cwd: string, agentDir: string): boolean {
  if (!hasTrustRequiringProjectResources(cwd)) return true
  const saved = new ProjectTrustStore(agentDir).get(cwd)
  if (saved !== null) return saved
  const settings = SettingsManager.create(cwd, agentDir, { projectTrusted: false })
  return settings.getDefaultProjectTrust() === 'always'
}

export class AgentHost {
  private runtime: AgentSessionRuntime | null = null
  private unsubscribe: (() => void) | null = null
  private listeners: Array<(event: SessionEvent) => void> = []

  constructor(readonly cwd: string) {}

  onEvent(listener: (event: SessionEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener)
    }
  }

  async start(): Promise<void> {
    if (this.runtime) throw new Error('Agent already started')

    const agentDir = getAgentDir()
    const projectTrusted = isProjectTrusted(this.cwd, agentDir)
    const settingsManager = SettingsManager.create(this.cwd, agentDir, { projectTrusted })

    const createRuntime: CreateAgentSessionRuntimeFactory = async ({
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

    const runtime = await createAgentSessionRuntime(createRuntime, {
      cwd: this.cwd,
      agentDir,
      sessionManager: SessionManager.create(this.cwd, settingsManager.getSessionDir()),
    })

    const errors = runtime.diagnostics.filter((item) => item.type === 'error')
    if (errors.length > 0) {
      await runtime.dispose()
      throw new Error(errors.map((item) => item.message).join('\n'))
    }

    this.runtime = runtime
    runtime.setRebindSession(() => this.bindSession())
    try {
      await this.bindSession()
    } catch (error) {
      await this.stop()
      throw error
    }

    void runtime.session.modelRuntime
      .refresh({ signal: AbortSignal.timeout(MODEL_REFRESH_MS) })
      .catch(() => {})
  }

  async stop(): Promise<void> {
    const runtime = this.runtime
    if (!runtime) return
    this.unsubscribe?.()
    this.unsubscribe = null
    this.runtime = null
    try {
      await runtime.session.abort()
    } catch {
      // still dispose
    }
    await runtime.dispose()
  }

  async prompt(message: string): Promise<void> {
    const session = this.session
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
      void session
        .prompt(message, {
          source: 'rpc',
          preflightResult: (ok) => {
            if (ok) succeed()
            else fail(new Error('Prompt rejected'))
          },
        })
        .catch(fail)
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

  getAvailableModels(): ModelInfo[] {
    return this.session.modelRuntime.getAvailableSnapshot().map(toModelInfo)
  }

  getAvailableThinkingLevels(): ThinkingLevel[] {
    return parseThinkingLevels(this.session.getAvailableThinkingLevels())
  }

  async setModel(provider: string, modelId: string): Promise<ModelSelection> {
    const model = this.session.modelRuntime
      .getAvailableSnapshot()
      .find((item) => item.provider === provider && item.id === modelId)
    if (!model) throw new Error(`Model not found: ${provider}/${modelId}`)
    await this.session.setModel(model)
    return this.getModelSelection()
  }

  async setThinkingLevel(level: ThinkingLevel): Promise<ModelSelection> {
    this.session.setThinkingLevel(level)
    return this.getModelSelection()
  }

  async switchSession(sessionPath: string): Promise<{ cancelled: boolean }> {
    return this.requireRuntime().switchSession(sessionPath)
  }

  async newSession(): Promise<{ cancelled: boolean }> {
    return this.requireRuntime().newSession()
  }

  private get session(): AgentSession {
    return this.requireRuntime().session
  }

  private requireRuntime(): AgentSessionRuntime {
    if (!this.runtime) throw new Error('Not connected to pi')
    return this.runtime
  }

  private getModelSelection(): ModelSelection {
    const state = this.getState()
    return {
      model: state.model ?? { id: '', name: 'unknown', provider: '' },
      thinkingLevel: state.thinkingLevel,
      thinkingLevels: this.getAvailableThinkingLevels(),
    }
  }

  private async bindSession(): Promise<void> {
    const runtime = this.requireRuntime()
    const session = runtime.session
    this.unsubscribe?.()
    await session.bindExtensions({
      mode: 'rpc',
      commandContextActions: {
        waitForIdle: () => session.waitForIdle(),
        newSession: (options) => runtime.newSession(options),
        fork: async (entryId, options) => {
          const result = await runtime.fork(entryId, options)
          return { cancelled: result.cancelled }
        },
        navigateTree: async (targetId, options) => {
          const result = await session.navigateTree(targetId, options)
          return { cancelled: result.cancelled }
        },
        switchSession: (sessionPath, options) => runtime.switchSession(sessionPath, options),
        reload: () => session.reload(),
      },
    })
    this.unsubscribe = session.subscribe((event) => {
      const mapped = toSessionEvent(event)
      if (!mapped) return
      for (const listener of this.listeners) listener(mapped)
    })
  }
}

function toModelInfo(model: { id?: string; name?: string; provider?: string }): ModelInfo {
  return {
    id: String(model.id ?? ''),
    name: String(model.name || model.id || 'unknown'),
    provider: String(model.provider ?? ''),
  }
}
