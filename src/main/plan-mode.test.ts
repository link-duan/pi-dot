import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlanMode, isInPlansDir, isPlanFileWrite, planFilePath, planStep } from './plan-mode'

describe('isPlanFileWrite', () => {
  const plan = '/home/me/.pi-dot/plans/abc.md'

  it('matches the plan file by absolute, relative, @ and ~ paths', () => {
    expect(isPlanFileWrite({ path: plan }, '/work', plan)).toBe(true)
    expect(isPlanFileWrite({ path: '../home/me/.pi-dot/plans/abc.md' }, '/work', plan)).toBe(true)
    expect(isPlanFileWrite({ path: `@${plan}` }, '/work', plan)).toBe(true)
  })

  it('rejects other files and traversal tricks', () => {
    expect(isPlanFileWrite({ path: 'README.md' }, '/work', plan)).toBe(false)
    expect(isPlanFileWrite({ path: `${plan}/../other.md` }, '/work', plan)).toBe(false)
    expect(isPlanFileWrite({}, '/work', plan)).toBe(false)
  })
})

describe('planStep', () => {
  const off = { active: false, count: 0 }

  it('enters with full, or reentry when a plan already exists', () => {
    expect(planStep(off, true, false)).toEqual({
      state: { active: true, count: 1 },
      reminder: 'full',
    })
    expect(planStep(off, true, true).reminder).toBe('reentry')
  })

  it('sends sparse reminders and refreshes the full rules every fifth', () => {
    let state = planStep(off, true, false).state
    const reminders: (string | null)[] = []
    for (let i = 0; i < 5; i++) {
      const step = planStep(state, true, true)
      reminders.push(step.reminder)
      state = step.state
    }
    expect(reminders).toEqual(['sparse', 'sparse', 'sparse', 'sparse', 'full'])
    expect(planStep({ active: true, count: 0 }, true, true).reminder).toBe('full')
  })

  it('exits once', () => {
    const exit = planStep({ active: true, count: 3 }, false, true)
    expect(exit).toEqual({ state: off, reminder: 'exit' })
    expect(planStep(exit.state, false, true).reminder).toBeNull()
  })

  it('carries the plan on approval, even after plan mode already ended', () => {
    expect(planStep({ active: true, count: 3 }, false, true, true).reminder).toBe('approved')
    expect(planStep(off, false, true, true)).toEqual({ state: off, reminder: 'approved' })
  })
})

type Handler = (event: unknown, ctx: unknown) => unknown

function fakePi(entries: unknown[] = []) {
  const handlers: Record<string, Handler> = {}
  const appended: unknown[] = []
  const pi = {
    on: (name: string, handler: Handler) => {
      handlers[name] = handler
    },
    appendEntry: (customType: string, data: unknown) => appended.push({ customType, data }),
  }
  const ctx = {
    cwd: '/work',
    sessionManager: { getSessionId: () => 'abc', getBranch: () => entries },
  }
  return {
    pi: pi as unknown as ExtensionAPI,
    appended,
    emit: (name: string, event: unknown = {}) => handlers[name]?.(event, ctx),
  }
}

describe('createPlanMode', () => {
  let home: string

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'pi-dot-plan-'))
    vi.stubEnv('HOME', home)
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(home, { recursive: true, force: true })
  })

  const editReadme = { toolName: 'edit', input: { path: 'README.md' } }

  it('teaches the plan file format in the full rules and stays tool-free', async () => {
    const plan = createPlanMode()
    const fake = fakePi()
    await plan.extension(fake.pi)
    fake.emit('session_start')
    expect(plan.planPath).toBe(planFilePath('abc'))

    plan.setNext(true)
    const full = fake.emit('before_agent_start') as { message: { content: string } }
    expect(full.message.content).toContain('name: <short title>')
    expect(full.message.content).toContain('overview:')
    const sparse = fake.emit('before_agent_start') as { message: { content: string } }
    expect(sparse.message.content).toContain('only when the user clicks Build')
    for (const text of [full.message.content, sparse.message.content]) {
      expect(text).not.toContain('exit_plan_mode')
    }
  })

  it('reports the mode in effect, not the pending one, and notifies on changes', async () => {
    const plan = createPlanMode()
    const fake = fakePi()
    const changes: boolean[] = []
    plan.onChange((active) => changes.push(active))
    await plan.extension(fake.pi)
    fake.emit('session_start')

    plan.setNext(true)
    expect(plan.active).toBe(false)
    fake.emit('before_agent_start')
    expect(plan.active).toBe(true)
    fake.emit('before_agent_start')
    plan.setNext(false)
    fake.emit('before_agent_start')
    expect(plan.active).toBe(false)
    expect(changes).toEqual([false, true, false])
  })

  it('only opens real files inside the plans dir', async () => {
    const path = planFilePath('abc')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, '# Plan\n')
    expect(isInPlansDir(path)).toBe(true)
    const outside = join(home, 'evil.md')
    await writeFile(outside, 'x')
    await symlink(outside, join(dirname(path), 'link.md'))
    expect(isInPlansDir(join(dirname(path), 'link.md'))).toBe(false)
    expect(isInPlansDir(join(dirname(path), '../config.toml'))).toBe(false)
  })

  it('switches only at the next run boundary', async () => {
    const plan = createPlanMode()
    const fake = fakePi()
    await plan.extension(fake.pi)
    fake.emit('session_start')

    plan.setNext(true)
    expect(fake.emit('tool_call', editReadme)).toBeUndefined()

    const started = fake.emit('before_agent_start') as { message: { content: string } }
    expect(started.message.content).toContain('Plan mode is active.')
    expect(fake.emit('tool_call', editReadme)).toMatchObject({ block: true })
    expect(
      fake.emit('tool_call', { toolName: 'write', input: { path: planFilePath('abc') } }),
    ).toBeUndefined()

    plan.setNext(false)
    expect(fake.emit('tool_call', editReadme)).toMatchObject({ block: true })
    const ended = fake.emit('before_agent_start') as { message: { content: string } }
    expect(ended.message.content).toContain('Plan mode has ended.')
    expect(fake.emit('tool_call', editReadme)).toBeUndefined()
    expect(fake.appended).toEqual([
      { customType: 'pi-dot-plan-mode', data: { enabled: true } },
      { customType: 'pi-dot-plan-mode', data: { enabled: false } },
    ])
  })

  it('hands the current plan file to the model on approval', async () => {
    const plan = createPlanMode()
    const fake = fakePi()
    await plan.extension(fake.pi)
    fake.emit('session_start')
    plan.setNext(true)
    fake.emit('before_agent_start')

    const path = planFilePath('abc')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, '# Plan\n\nEdited by the user.\n')
    plan.setNext(false, true)
    const approved = fake.emit('before_agent_start') as { message: { content: string } }
    expect(approved.message.content).toContain('The user approved the plan.')
    expect(approved.message.content).toContain('Edited by the user.')
    expect(fake.emit('tool_call', editReadme)).toBeUndefined()
  })

  const savedOn = { type: 'custom', customType: 'pi-dot-plan-mode', data: { enabled: true } }

  it('restores plan mode as active after a restart, with the full rules', async () => {
    const plan = createPlanMode()
    const fake = fakePi([savedOn])
    await plan.extension(fake.pi)
    fake.emit('session_start')
    expect(plan.active).toBe(true)
    expect(fake.emit('tool_call', editReadme)).toMatchObject({ block: true })

    const first = fake.emit('before_agent_start') as { message: { content: string } }
    expect(first.message.content).toContain('Plan mode is active.')
    const second = fake.emit('before_agent_start') as { message: { content: string } }
    expect(second.message.content).toContain('still active')
    fake.emit('session_compact')
    const third = fake.emit('before_agent_start') as { message: { content: string } }
    expect(third.message.content).toContain('Plan mode is active.')
  })

  it('exits and persists the change when turned off right after a restart', async () => {
    const plan = createPlanMode()
    const fake = fakePi([savedOn])
    await plan.extension(fake.pi)
    fake.emit('session_start')
    plan.setNext(false)
    const ended = fake.emit('before_agent_start') as { message: { content: string } }
    expect(ended.message.content).toContain('Plan mode has ended.')
    expect(fake.appended).toEqual([{ customType: 'pi-dot-plan-mode', data: { enabled: false } }])
  })

  it('hands over the plan when approved right after a restart', async () => {
    const plan = createPlanMode()
    const fake = fakePi([savedOn])
    await plan.extension(fake.pi)
    fake.emit('session_start')
    const path = planFilePath('abc')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, '# Plan\n\nShip it.\n')
    plan.setNext(false, true)
    const approved = fake.emit('before_agent_start') as { message: { content: string } }
    expect(approved.message.content).toContain('Ship it.')
  })

  it('follows the branch on tree navigation', async () => {
    const entries: unknown[] = []
    const plan = createPlanMode()
    const fake = fakePi(entries)
    await plan.extension(fake.pi)
    fake.emit('session_start')
    expect(plan.active).toBe(false)

    entries.push(savedOn)
    fake.emit('session_tree')
    expect(plan.active).toBe(true)
    expect(fake.emit('tool_call', editReadme)).toMatchObject({ block: true })
  })
})
