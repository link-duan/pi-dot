import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { Type } from '@earendil-works/pi-ai'
import type {
  ExtensionContext,
  ExtensionFactory,
  SessionEntry,
} from '@earendil-works/pi-coding-agent'
import { stringify } from 'yaml'
import { CREATE_PLAN_TOOL, type PlanRef } from '@shared/protocol'
import { piDotDir } from './config'

/** Custom entries in the session transcript, the source of truth for plan state; see `replayPlan`. */
const ENTRY_TYPE = 'pi-dot-plan'

export type PlanEntry =
  | { kind: 'mode'; active: boolean }
  | { kind: 'created'; path: string }
  | { kind: 'built'; path: string }
/** Every Nth reminder of a planning stretch repeats the full rules instead of the one-liner. */
const FULL_EVERY = 5

export type PlanReminder = 'full' | 'sparse' | 'reentry' | 'exit' | 'approved'

export interface PlanState {
  /** Mode in effect for the current run. */
  active: boolean
  /** Reminders injected since entering plan mode or the last compaction. */
  count: number
}

export function plansDir(): string {
  return join(piDotDir(), 'plans')
}

/** File-name stem for a plan: keeps letters and digits in any script, the rest become `_`. */
export function planSlug(name: string): string {
  const slug = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
  return [...slug].slice(0, 50).join('').replace(/_+$/, '') || 'plan'
}

/** Writes a new Plan File: `<slug>_<hex>.plan.md` with `name` / `overview` frontmatter. */
export function writePlanFile(name: string, overview: string, plan: string): string {
  mkdirSync(plansDir(), { recursive: true })
  const path = join(plansDir(), `${planSlug(name)}_${randomBytes(4).toString('hex')}.plan.md`)
  writeFileSync(
    path,
    `---\n${stringify({ name, overview }, { lineWidth: 0 })}---\n\n${plan.trim()}\n`,
    {
      flag: 'wx',
    },
  )
  return path
}

/**
 * Replays the plan entries on a session branch, in order: the last `mode` is the mode in effect,
 * the last `created` is the current plan, built once a later `built` names it.
 * A fork replays its parent's entries too, so the two sessions share that Plan File.
 */
export function replayPlan(entries: readonly SessionEntry[]): { active: boolean; plan: PlanRef } {
  let active = false
  let plan = null as PlanRef
  for (const entry of entries) {
    if (entry.type !== 'custom' || entry.customType !== ENTRY_TYPE) continue
    const data = entry.data as PlanEntry | undefined
    if (data?.kind === 'mode') active = data.active
    else if (data?.kind === 'created') plan = { path: data.path, built: false }
    else if (data?.kind === 'built' && plan?.path === data.path)
      plan = { path: data.path, built: true }
  }
  return { active, plan }
}

/** Resolves symlinks, so a link placed in the plans dir can't point `openPath` elsewhere. */
export function isInPlansDir(path: string): boolean {
  try {
    const real = realpathSync(path)
    return real.startsWith(realpathSync(plansDir()) + sep) && real.endsWith('.md')
  } catch {
    return false
  }
}

/** Mirrors how pi's file tools resolve `path`: optional `@` prefix, `~` expansion, cwd-relative. */
export function isPlanFileWrite(input: unknown, cwd: string, planPath: string): boolean {
  const raw = (input as { path?: unknown } | null)?.path
  if (typeof raw !== 'string') return false
  let path = raw.startsWith('@') ? raw.slice(1) : raw
  if (path === '~' || path.startsWith('~/')) path = join(homedir(), path.slice(1))
  return resolve(cwd, path) === planPath
}

/**
 * Runs once per run, at `before_agent_start`; see the injection table in the plan mode design.
 * `hasPlan` means there is a plan under review (created and not built) to come back to.
 * `approved` hands the plan over even if plan mode already ended.
 */
export function planStep(
  state: PlanState,
  next: boolean,
  hasPlan: boolean,
  approved = false,
): { state: PlanState; reminder: PlanReminder | null } {
  if (next && !state.active) {
    return { state: { active: true, count: 1 }, reminder: hasPlan ? 'reentry' : 'full' }
  }
  if (next) {
    return {
      state: { active: true, count: state.count + 1 },
      reminder: state.count % FULL_EVERY === 0 ? 'full' : 'sparse',
    }
  }
  // A plan can be approved after plan mode already ended (the user re-opened the toggle to review it).
  if (approved) return { state: { active: false, count: 0 }, reminder: 'approved' }
  if (state.active) return { state: { active: false, count: 0 }, reminder: 'exit' }
  return { state, reminder: null }
}

/** The plan under review, if any: a built plan is done, and the next one needs `create_plan`. */
function reviewing(plan: PlanRef): string | null {
  return plan && !plan.built ? plan.path : null
}

function rules(path: string | null): string[] {
  return [
    'Read-only: plan instead of implementing; use bash only to inspect.',
    path
      ? `Change only ${path}.`
      : `Write the plan with ${CREATE_PLAN_TOOL}, then change only that file.`,
  ]
}

function workflow(path: string | null): string[] {
  return [
    'Workflow:',
    '1. Explore the code first; reuse what exists.',
    "2. Ask the user only when a decision changes the plan and the code can't answer it: 1–2 questions, each with options and your pick; then end your turn.",
    path
      ? `3. Revise ${path} in place (edit it, or rewrite it with write when that's simpler); keep it decision-complete and in the user's language.`
      : `3. Call ${CREATE_PLAN_TOOL} with one decision-complete plan in the user's language.`,
    '4. End your turn for review; the plan runs only when the user clicks Build.',
  ]
}

export function reminderText(reminder: PlanReminder, plan: PlanRef, content: string): string {
  const path = reviewing(plan)
  const lines = (() => {
    switch (reminder) {
      case 'full':
        return ['Plan mode is active.', ...rules(path), ...workflow(path)]
      case 'reentry':
        return [
          `Plan mode again. Under review: ${path}. Same task: revise it; different task: call ${CREATE_PLAN_TOOL}.`,
          ...rules(path),
          ...workflow(path),
        ]
      case 'sparse':
        return [
          path
            ? `Plan mode: treat this message as feedback and revise ${path}; read-only otherwise.`
            : `Plan mode: read-only; write the plan with ${CREATE_PLAN_TOOL}.`,
        ]
      case 'exit':
        return ['Plan mode ended; you may edit files and run commands.']
      case 'approved':
        return [
          `The user approved the plan in ${plan?.path} (it may include their edits). Plan mode ended; implement it:`,
          '',
          content,
        ]
    }
  })()
  return `<plan_mode>\n${lines.join('\n')}\n</plan_mode>`
}

export function readPlan(path: string): string {
  try {
    return readFileSync(path, 'utf8').trim()
  } catch {
    return ''
  }
}

const CREATE_PLAN_DESCRIPTION =
  'Create a new Plan File for the user to review (plan mode only). Call once per plan; afterwards revise the returned file in place.'

export interface PlanMode {
  extension: ExtensionFactory
  /** Mode in effect for the current (or last) run. */
  readonly active: boolean
  /** The session's current plan, replayed from its transcript. */
  readonly plan: PlanRef
  /** Fires when the mode in effect or the current plan changes. */
  onChange(listener: (state: { active: boolean; plan: PlanRef }) => void): () => void
  /**
   * Called right before `session.prompt()`, so the next `before_agent_start` applies it.
   * `approved` hands the current Plan File to the model as it leaves plan mode.
   */
  setNext(planMode: boolean, approved?: boolean): void
}

export function createPlanMode(): PlanMode {
  let next = false
  let approved = false
  let state: PlanState = { active: false, count: 0 }
  let plan: PlanRef = null
  const listeners = new Set<(state: { active: boolean; plan: PlanRef }) => void>()
  const notify = () => {
    for (const listener of listeners) listener({ active: state.active, plan })
  }

  const extension: ExtensionFactory = (pi) => {
    const record = (entry: PlanEntry) => pi.appendEntry(ENTRY_TYPE, entry)

    pi.registerTool({
      name: CREATE_PLAN_TOOL,
      label: 'Create Plan',
      description: CREATE_PLAN_DESCRIPTION,
      parameters: Type.Object({
        name: Type.String({ description: "Short title, in the user's language." }),
        overview: Type.String({ description: '1–2 sentences: root cause and approach.' }),
        plan: Type.String({
          description:
            "Markdown without frontmatter, in the user's language, with sections (translated): Context, Approach, Files to change, Existing code to reuse, Verification.",
        }),
      }),
      async execute(_toolCallId, params) {
        if (!state.active) throw new Error('Plan mode is not active.')
        const path = writePlanFile(params.name, params.overview, params.plan)
        plan = { path, built: false }
        record({ kind: 'created', path })
        notify()
        return {
          content: [
            {
              type: 'text',
              text: `Created ${path}. Revise that file in place and wait for the user's review.`,
            },
          ],
          details: { path },
        }
      },
    })

    function restore(ctx: ExtensionContext): void {
      const replayed = replayPlan(ctx.sessionManager.getBranch())
      next = replayed.active
      // A deleted plan file leaves nothing to review.
      plan = replayed.plan && existsSync(replayed.plan.path) ? replayed.plan : null
      // count 0 makes the next run repeat the full rules.
      state = { active: next, count: 0 }
      approved = false
      // The tool stays declared so the loadout (and prompt cache) never changes with the mode.
      // pi restores a resumed session's loadout from its transcript, which may predate the tool.
      const tools = pi.getActiveTools()
      if (!tools.includes(CREATE_PLAN_TOOL)) pi.setActiveTools([...tools, CREATE_PLAN_TOOL])
      notify()
    }

    pi.on('session_start', (_event, ctx) => restore(ctx))
    pi.on('session_tree', (_event, ctx) => restore(ctx))

    pi.on('session_compact', () => {
      state = { ...state, count: 0 }
    })

    pi.on('tool_call', (event, ctx) => {
      if (!state.active || (event.toolName !== 'edit' && event.toolName !== 'write')) return
      const path = reviewing(plan)
      if (path && isPlanFileWrite(event.input, ctx.cwd, path)) return
      return {
        block: true,
        reason: path
          ? `Rejected: plan mode — only ${path} is editable.`
          : `Rejected: plan mode — write the plan with ${CREATE_PLAN_TOOL} first.`,
      }
    })

    pi.on('before_agent_start', () => {
      // Approving needs a plan to hand over; without one (its file is gone) it's a plain exit.
      const step = planStep(state, next, reviewing(plan) !== null, approved && plan !== null)
      approved = false
      let changed = step.state.active !== state.active
      if (changed) record({ kind: 'mode', active: step.state.active })
      if (step.reminder === 'approved' && plan && !plan.built) {
        plan = { ...plan, built: true }
        record({ kind: 'built', path: plan.path })
        changed = true
      }
      state = step.state
      if (changed) notify()
      // Only the approval hands the plan's content over.
      const content = step.reminder === 'approved' && plan ? readPlan(plan.path) : ''
      if (!step.reminder) return
      return {
        message: {
          customType: ENTRY_TYPE,
          content: reminderText(step.reminder, plan, content),
          display: false,
        },
      }
    })
  }

  return {
    extension,
    get active() {
      return state.active
    },
    get plan() {
      return plan
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setNext(planMode, isApproval = false) {
      next = planMode
      approved = isApproval
    },
  }
}
