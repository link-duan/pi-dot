import { readFile, rm, mkdtemp, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import type { ExtensionAPI, SessionEntry } from '@earendil-works/pi-coding-agent'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPlanMode,
  isInPlansDir,
  isPlanFileWrite,
  planSlug,
  planStep,
  replayPlan,
  writePlanFile,
  type PlanEntry,
} from './plan-mode'

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

describe('planSlug', () => {
  it('keeps letters and digits in any script and joins the rest with _', () => {
    expect(planSlug('Stream Event Redesign')).toBe('stream_event_redesign')
    expect(planSlug('审批模块：架构设计')).toBe('审批模块_架构设计')
    expect(planSlug('Fix ../etc/passwd: v2!')).toBe('fix_etc_passwd_v2')
    expect(planSlug('Ｆｕｌｌ　Ｗｉｄｔｈ')).toBe('full_width')
  })

  it('caps the length by characters and falls back to "plan"', () => {
    expect([...planSlug('长'.repeat(80))]).toHaveLength(50)
    expect(planSlug('a '.repeat(40))).not.toMatch(/_$/)
    expect(planSlug('!!!')).toBe('plan')
  })
})

const entry = (data: PlanEntry | Record<string, unknown>, customType = 'pi-dot-plan') =>
  ({ type: 'custom', customType, data }) as unknown as SessionEntry

describe('replayPlan', () => {
  it('replays mode, the latest plan, and whether that plan was built', () => {
    expect(replayPlan([])).toEqual({ active: false, plan: null })
    expect(
      replayPlan([
        entry({ kind: 'mode', active: true }),
        entry({ kind: 'created', path: '/p/a.plan.md' }),
        entry({ kind: 'mode', active: false }),
        entry({ kind: 'built', path: '/p/a.plan.md' }),
      ]),
    ).toEqual({ active: false, plan: { path: '/p/a.plan.md', built: true } })
  })

  it('starts a new plan unbuilt, and only counts builds of the current plan', () => {
    expect(
      replayPlan([
        entry({ kind: 'created', path: '/p/a.plan.md' }),
        entry({ kind: 'built', path: '/p/a.plan.md' }),
        entry({ kind: 'mode', active: true }),
        entry({ kind: 'created', path: '/p/b.plan.md' }),
        entry({ kind: 'built', path: '/p/a.plan.md' }),
      ]).plan,
    ).toEqual({ path: '/p/b.plan.md', built: false })
  })

  it('ignores the old pi-dot-plan-mode entries', () => {
    expect(replayPlan([entry({ enabled: true }, 'pi-dot-plan-mode')])).toEqual({
      active: false,
      plan: null,
    })
  })
})

type Handler = (event: unknown, ctx: unknown) => unknown
type Tool = { name: string; execute: (id: string, params: unknown) => Promise<unknown> }

function fakePi(entries: SessionEntry[] = [], sessionId = 'sess-1') {
  const handlers: Record<string, Handler> = {}
  const appended: PlanEntry[] = []
  let tool: Tool | undefined
  let active = ['read', 'edit', 'write']
  const pi = {
    on: (name: string, handler: Handler) => {
      handlers[name] = handler
    },
    registerTool: (definition: Tool) => {
      tool = definition
    },
    getActiveTools: () => active,
    setActiveTools: (names: string[]) => {
      active = names
    },
    // Appended entries land on the branch, as in a real session.
    appendEntry: (customType: string, data: PlanEntry) => {
      appended.push(data)
      entries.push(entry(data, customType))
    },
  }
  const ctx = {
    cwd: '/work',
    sessionManager: { getBranch: () => entries, getSessionId: () => sessionId },
  }
  return {
    pi: pi as unknown as ExtensionAPI,
    appended,
    activeTools: () => active,
    createPlan: (params: { name: string; overview: string; plan: string }) =>
      tool!.execute('call', params) as Promise<{ details: { path: string } }>,
    emit: (name: string, event: unknown = {}) => handlers[name]?.(event, ctx),
    reminder: () =>
      (handlers.before_agent_start?.({}, ctx) as { message: { content: string } } | undefined)
        ?.message.content,
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

  const write = (path: string) => ({ toolName: 'write', input: { path } })
  const editReadme = write('README.md')
  const draft = { name: 'Debounce search', overview: 'Why: slow.', plan: '## Context\nSlow.' }

  async function started(entries: SessionEntry[] = [], sessionId = 'sess-1') {
    const plan = createPlanMode()
    const fake = fakePi(entries, sessionId)
    await plan.extension(fake.pi)
    fake.emit('session_start')
    return { plan, fake }
  }

  it('keeps create_plan declared and rejects it outside plan mode', async () => {
    const { fake } = await started()
    expect(fake.activeTools()).toContain('create_plan')
    await expect(fake.createPlan(draft)).rejects.toThrow('Plan mode is not active.')
  })

  it('asks for create_plan, then lets the model edit only the plan it created', async () => {
    const { plan, fake } = await started()
    plan.setNext(true)
    const full = fake.reminder()
    expect(full).toContain('Call create_plan')
    expect(full).toContain("in the user's language")
    expect(fake.emit('tool_call', editReadme)).toMatchObject({
      reason: expect.stringContaining('create_plan first'),
    })

    const { details } = await fake.createPlan(draft)
    expect(basename(details.path)).toMatch(/^debounce_search_[0-9a-f]{8}\.plan\.md$/)
    expect(await readFile(details.path, 'utf8')).toBe(
      '---\nname: Debounce search\noverview: "Why: slow."\n---\n\n## Context\nSlow.\n',
    )
    expect(plan.plan).toEqual({ path: details.path, built: false })
    expect(fake.emit('tool_call', write(details.path))).toBeUndefined()
    expect(fake.emit('tool_call', editReadme)).toMatchObject({ block: true })
    expect(fake.reminder()).toContain(`revise ${details.path}`)
  })

  it('builds the plan for good: read-only after approval, and the next round needs a new one', async () => {
    const { plan, fake } = await started()
    const changes: unknown[] = []
    plan.onChange((state) => changes.push(state))
    plan.setNext(true)
    fake.reminder()
    const { details } = await fake.createPlan(draft)
    await writeFile(details.path, '---\nname: X\n---\n\nEdited by the user.\n')

    plan.setNext(false, true)
    const approved = fake.reminder()
    expect(approved).toContain('The user approved the plan in')
    expect(approved).toContain('Edited by the user.')
    expect(plan.plan).toEqual({ path: details.path, built: true })
    expect(changes.at(-1)).toEqual({ active: false, plan: { path: details.path, built: true } })
    expect(fake.appended).toEqual([
      { kind: 'mode', active: true },
      { kind: 'created', path: details.path },
      { kind: 'mode', active: false },
      { kind: 'built', path: details.path },
    ])

    plan.setNext(true)
    expect(fake.reminder()).toContain('Call create_plan')
    expect(fake.emit('tool_call', write(details.path))).toMatchObject({ block: true })
  })

  it('comes back to an unbuilt plan on re-entry', async () => {
    const { plan, fake } = await started()
    plan.setNext(true)
    fake.reminder()
    const { details } = await fake.createPlan(draft)
    plan.setNext(false)
    expect(fake.reminder()).toContain('Plan mode ended')
    plan.setNext(true)
    const reentry = fake.reminder()
    expect(reentry).toContain(`Under review: ${details.path}`)
    expect(reentry).toContain("in the user's language")
  })

  it('restores mode and plan from the transcript, following the branch', async () => {
    const path = writePlanFile('Saved', 'o', 'p')
    const entries = [entry({ kind: 'mode', active: true }), entry({ kind: 'created', path })]
    const { plan, fake } = await started(entries)
    expect(plan.active).toBe(true)
    expect(plan.plan).toEqual({ path, built: false })
    expect(fake.emit('tool_call', write(path))).toBeUndefined()
    expect(fake.reminder()).toContain('Plan mode is active.')

    entries.push(entry({ kind: 'built', path }))
    fake.emit('session_tree')
    expect(plan.plan).toEqual({ path, built: true })
  })

  it('treats approval without a plan as a plain exit', async () => {
    const { plan, fake } = await started([entry({ kind: 'mode', active: true })])
    plan.setNext(false, true)
    expect(fake.reminder()).toContain('Plan mode ended')
    expect(fake.appended).toEqual([{ kind: 'mode', active: false }])
  })

  it('notifies only when the mode or the plan changes', async () => {
    const { plan, fake } = await started()
    const changes: unknown[] = []
    plan.onChange((state) => changes.push(state))
    plan.setNext(true)
    fake.reminder()
    fake.reminder()
    plan.setNext(false)
    fake.reminder()
    fake.reminder()
    expect(changes).toEqual([
      { active: true, plan: null },
      { active: false, plan: null },
    ])
  })

  it('drops a plan whose file was deleted', async () => {
    const path = writePlanFile('Gone', 'o', 'p')
    await unlink(path)
    const { plan } = await started([entry({ kind: 'created', path })])
    expect(plan.plan).toBeNull()
  })

  it('reports the mode in effect, not the pending one', async () => {
    const { plan, fake } = await started()
    plan.setNext(true)
    expect(plan.active).toBe(false)
    fake.reminder()
    expect(plan.active).toBe(true)
  })

  it('only opens real files inside the plans dir', async () => {
    const path = writePlanFile('Real', 'o', 'p')
    expect(isInPlansDir(path)).toBe(true)
    const outside = join(home, 'evil.md')
    await writeFile(outside, 'x')
    await symlink(outside, join(dirname(path), 'link.md'))
    expect(isInPlansDir(join(dirname(path), 'link.md'))).toBe(false)
    expect(isInPlansDir(join(dirname(path), '../config.toml'))).toBe(false)
  })
})
