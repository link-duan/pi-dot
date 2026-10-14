import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentSession, AgentSessionEvent } from '@earendil-works/pi-coding-agent'
import type { SessionEvent } from '@shared/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentHost } from './agent-host'
import type { PlanMode } from './plan-mode'

describe('AgentHost SDK compatibility', () => {
  let directory: string
  let host: AgentHost
  let session: AgentSession
  let events: SessionEvent[]

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pi-ui-sdk-'))
    const cwd = join(directory, 'project')
    await mkdir(cwd)
    vi.stubEnv('PI_CODING_AGENT_DIR', join(directory, 'agent'))
    vi.stubEnv('PI_CODING_AGENT_SESSION_DIR', '')
    vi.stubEnv('PI_OFFLINE', '1')
    host = new AgentHost(cwd)
    events = []
    host.onEvent((event) => events.push(event))
    await host.start()
    // Keep queue tests on the installed SDK; only provider execution is stubbed.
    session = (host as unknown as { session: AgentSession }).session
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await host.stop()
    vi.unstubAllEnvs()
    await rm(directory, { recursive: true, force: true })
  })

  it('activates codemode by default but leaves tool search inactive', () => {
    expect(session.getAllTools().map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['codemode', 'tool_search']),
    )
    expect(session.getActiveToolNames()).toEqual(
      expect.arrayContaining(['read', 'bash', 'edit', 'write', 'codemode']),
    )
    expect(session.getActiveToolNames()).not.toContain('tool_search')
  })

  it.each([
    ['an explicit defaultTools setting', { defaultTools: ['read', 'bash'] }],
    ['a disabled codemode extension', { extensions: ['-builtin:codemode'] }],
  ])('does not force codemode over %s', async (_, settings) => {
    await writeFile(join(directory, 'agent/settings.json'), JSON.stringify(settings))
    const other = new AgentHost(host.cwd)
    await other.start()
    try {
      const otherSession = (other as unknown as { session: AgentSession }).session
      expect(otherSession.getActiveToolNames()).not.toContain('codemode')
    } finally {
      await other.stop()
    }
  })

  async function executeCodemode(code: string, signal = new AbortController().signal) {
    session.setActiveToolsByName([...session.getActiveToolNames(), 'codemode'])
    const tool = session.agent.state.tools.find((item) => item.name === 'codemode')
    if (!tool) throw new Error('Codemode is not registered')
    session.sessionManager.appendMessage({
      role: 'assistant',
      api: 'openai-completions',
      provider: 'fixture',
      model: 'fixture',
      content: [{ type: 'toolCall', id: 'codemode-test', name: 'codemode', arguments: { code } }],
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: 'toolUse',
      timestamp: Date.now(),
    })
    session.refreshContext()
    return tool.execute('codemode-test', { code }, signal)
  }

  it('gates edits made through codemode once plan mode is on, and reports the change', async () => {
    expect(host.snapshot().state.planMode).toBe(false)

    const planMode = (host as unknown as { planModes: WeakMap<object, PlanMode> }).planModes.get(
      session.sessionManager,
    )
    planMode?.setNext(true)
    const result = await session.extensionRunner.emitBeforeAgentStart(
      { messageType: 'user', prompt: 'plan it' },
      { cwd: host.cwd },
    )
    expect(result.messages[0]?.content).toContain('Plan mode is active.')
    expect(host.snapshot().state.planMode).toBe(true)
    expect(host.snapshot().state.plan).toBeNull()
    expect(session.getActiveToolNames()).toContain('create_plan')
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'plan_mode', active: true, plan: null }),
    )

    await writeFile(join(host.cwd, 'README.md'), 'original')
    const blocked = await executeCodemode(
      'await tools.edit({path:"README.md", edits:[{oldText:"original", newText:"changed"}]})',
    )
    expect(JSON.stringify(blocked.content)).toContain('Rejected: plan mode')
    expect(await readFile(join(host.cwd, 'README.md'), 'utf8')).toBe('original')
  })

  it('activates codemode from defaultTools on reload and honors disabling the extension', async () => {
    const defaultTools = ['+codemode', '+tool_search']
    await writeFile(join(directory, 'agent/settings.json'), JSON.stringify({ defaultTools }))
    await session.reload()
    expect(session.getActiveToolNames()).toEqual(
      expect.arrayContaining(['read', 'bash', 'codemode', 'tool_search']),
    )
    await writeFile(
      join(directory, 'agent/settings.json'),
      JSON.stringify({ defaultTools, extensions: ['-builtin:codemode'] }),
    )
    await session.reload()
    expect(session.getAllTools().map((tool) => tool.name)).not.toContain('codemode')
  })

  it('executes parallel nested reads in the real codemode worker', async () => {
    await writeFile(join(host.cwd, 'first.txt'), 'first fixture')
    await writeFile(join(host.cwd, 'second.txt'), 'second fixture')
    const sdkEvents: AgentSessionEvent[] = []
    session.subscribe((event) => sdkEvents.push(event))
    const result = await executeCodemode(
      'const results = await Promise.all([tools.read({path:"first.txt"}), tools.read({path:"second.txt"})]); text(results);',
    )
    expect(result).not.toHaveProperty('isError', true)
    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('Script completed'),
        }),
        expect.objectContaining({ type: 'text', text: expect.stringContaining('first fixture') }),
      ]),
    )
    expect(JSON.stringify(result.content)).toContain('second fixture')
    expect(result.details).toMatchObject({
      calls: [
        { name: 'read', status: 'ok' },
        { name: 'read', status: 'ok' },
      ],
    })
    expect(sdkEvents.filter((event) => event.type === 'tool_execution_end')).toHaveLength(2)
    expect(events.filter((event) => event.type.startsWith('tool_execution_'))).toEqual([])
  })

  it.each([
    ['throw new Error("codemode fixture failure")', 'codemode fixture failure'],
    ['await tools.read({path:"missing.txt"})', 'ENOENT'],
  ])('reports script and nested-tool failures: %s', async (code, error) => {
    const result = await executeCodemode(code)
    expect(result).toHaveProperty('isError', true)
    expect(JSON.stringify(result.content)).toContain('Script failed')
    expect(JSON.stringify(result.content)).toContain(error)
  })

  it('times out a runaway script without blocking the host', async () => {
    const result = await executeCodemode('// @options: {"timeout_ms": 50}\nwhile (true) {}')
    expect(result).toHaveProperty('isError', true)
    expect(JSON.stringify(result.content)).toContain('Script timed out')
  })

  it('aborts a running codemode worker', async () => {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 100)
    try {
      const result = await executeCodemode('while (true) {}', abort.signal)
      expect(result).toHaveProperty('isError', true)
      expect(JSON.stringify(result.content)).toContain('Script aborted')
    } finally {
      clearTimeout(timer)
    }
  })

  it.each(['started', 'queued', 'handled'] as const)(
    'acknowledges %s input before the prompt run finishes',
    async (disposition) => {
      const run = Promise.withResolvers<void>()
      vi.spyOn(session, 'prompt').mockImplementation((_text, options) => {
        options?.preflightResult?.(disposition)
        return run.promise
      })
      await expect(host.prompt('hello')).resolves.toBeUndefined()
      expect(host.runningSessionFiles()).toEqual([session.sessionFile])
      run.resolve()
      await vi.waitFor(() => expect(host.runningSessionFiles()).toEqual([]))
    },
  )

  it('settles when the SDK defers the prompt without a preflight result', async () => {
    vi.spyOn(session, 'prompt').mockResolvedValue(undefined)
    await expect(host.prompt('hello')).resolves.toBeUndefined()
    await vi.waitFor(() => expect(host.runningSessionFiles()).toEqual([]))
  })

  it('propagates prompt rejection and cleans up the run', async () => {
    vi.spyOn(session, 'prompt').mockRejectedValue(new Error('Input rejected'))
    await expect(host.prompt('hello')).rejects.toThrow('Input rejected')
    await vi.waitFor(() => expect(host.runningSessionFiles()).toEqual([]))
  })

  it('keeps the two queues independent when replacing, removing, and clearing', async () => {
    vi.spyOn(session, 'isStreaming', 'get').mockReturnValue(true)
    await host.steer('first')
    await host.steer('second')
    await host.followUp('later')
    await host.removeSteering(0)
    expect(host.snapshot().steeringQueue).toEqual(['second'])
    expect(host.snapshot().followUpQueue).toEqual(['later'])

    await host.setFollowUpQueue(['replacement', 'last'])
    expect(host.snapshot().steeringQueue).toEqual(['second'])
    expect(host.snapshot().followUpQueue).toEqual(['replacement', 'last'])

    await host.clearSteeringQueue()
    expect(events.at(-1)).toMatchObject({
      type: 'queue_update',
      steering: [],
      followUp: ['replacement', 'last'],
    })
    await host.setFollowUpQueue([])
    expect(events.at(-1)).toMatchObject({ type: 'queue_update', steering: [], followUp: [] })

    await host.steer('steer')
    await host.followUp('follow up')
    await expect(host.clearQueue()).resolves.toEqual({
      steering: ['steer'],
      followUp: ['follow up'],
    })
    expect(session.agent.hasQueuedMessages()).toBe(false)
  })

  it('promotes a follow-up to steering', async () => {
    vi.spyOn(session, 'isStreaming', 'get').mockReturnValue(true)
    await host.followUp('first')
    await host.followUp('second')
    await host.promoteFollowUp(0)
    expect(host.snapshot().steeringQueue).toEqual(['first'])
    expect(host.snapshot().followUpQueue).toEqual(['second'])
  })

  it('restores the follow-up queue when replacement fails', async () => {
    vi.spyOn(session, 'isStreaming', 'get').mockReturnValue(true)
    await host.followUp('original')
    vi.spyOn(session, 'followUp').mockRejectedValueOnce(new Error('Queue rejected'))
    await expect(host.setFollowUpQueue(['replacement'])).rejects.toThrow('Queue rejected')
    expect(host.snapshot().followUpQueue).toEqual(['original'])
    expect(session.agent.hasQueuedMessages()).toBe(true)
    expect(events.at(-1)).toMatchObject({
      type: 'queue_update',
      steering: [],
      followUp: ['original'],
    })
  })

  it('restores steering when removal fails', async () => {
    vi.spyOn(session, 'isStreaming', 'get').mockReturnValue(true)
    await host.steer('first')
    await host.steer('second')
    vi.spyOn(session, 'steer').mockRejectedValueOnce(new Error('Queue rejected'))
    await expect(host.removeSteering(0)).rejects.toThrow('Queue rejected')
    expect(host.snapshot().steeringQueue).toEqual(['first', 'second'])
  })

  it('restores follow-ups when promotion fails', async () => {
    vi.spyOn(session, 'isStreaming', 'get').mockReturnValue(true)
    await host.followUp('first')
    await host.followUp('second')
    vi.spyOn(session, 'steer').mockRejectedValueOnce(new Error('Queue rejected'))
    await expect(host.promoteFollowUp(0)).rejects.toThrow('Queue rejected')
    expect(host.snapshot().followUpQueue).toEqual(['first', 'second'])
    expect(host.snapshot().steeringQueue).toEqual([])
  })
})
