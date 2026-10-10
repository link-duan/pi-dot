import { readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import type {
  CustomEntry,
  ExtensionContext,
  ExtensionFactory,
} from '@earendil-works/pi-coding-agent'
import { piDotDir } from './config'

const ENTRY_TYPE = 'pi-dot-plan-mode'
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

export function planFilePath(sessionId: string): string {
  return join(plansDir(), `${sessionId}.md`)
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
 * `approved` hands the plan over even if plan mode already ended.
 */
export function planStep(
  state: PlanState,
  next: boolean,
  planHasContent: boolean,
  approved = false,
): { state: PlanState; reminder: PlanReminder | null } {
  if (next && !state.active) {
    return { state: { active: true, count: 1 }, reminder: planHasContent ? 'reentry' : 'full' }
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

function rules(path: string, planHasContent: boolean): string[] {
  return [
    'Do not modify the project — no edits, writes, or state-changing commands; bash is for read-only inspection.',
    `The only file you may write is the plan file: ${path} (${planHasContent ? 'it already has content; read it first' : 'not created yet'}).`,
    'If the user asks you to implement something, plan it instead.',
  ]
}

function workflow(path: string): string[] {
  return [
    'Workflow:',
    '1. Explore first and answer what you can from the code; prefer reusing existing functions and patterns.',
    '2. If a decision materially changes the plan and cannot be discovered by reading, ask the user in plain text — 1–2 questions at a time, each with options and your recommendation — then end your turn.',
    `3. Write a decision-complete plan to ${path}: the recommended approach only, no options left for the user to pick. Use this format:`,
    '---',
    'name: <short title>',
    'overview: <1–2 sentences: the root cause and the gist of the approach>',
    '---',
    '',
    '## Context',
    '## Files to change',
    '## Existing code to reuse',
    '## Verification',
    '4. Then end your turn and wait for review. Revise the same file on feedback, keeping the frontmatter current; the plan is executed only when the user clicks Build.',
  ]
}

export function reminderText(reminder: PlanReminder, path: string, plan: string): string {
  const planHasContent = plan.length > 0
  const lines = (() => {
    switch (reminder) {
      case 'full':
        return ['Plan mode is active.', ...rules(path, planHasContent), ...workflow(path)]
      case 'reentry':
        return [
          `You are entering plan mode again. A plan from earlier exists at ${path}. Read it first: if the new request is a different task, overwrite it; if it is the same task, revise it.`,
          ...rules(path, planHasContent),
          ...workflow(path),
        ]
      case 'sparse':
        return [
          `Plan mode is still active. Treat the user's message as feedback on the plan and update ${path}; the plan is executed only when the user clicks Build. Read-only except ${path}.`,
        ]
      case 'exit':
        return ['Plan mode has ended. You may now edit files and run commands.']
      case 'approved':
        return [
          `The user approved the plan. Plan mode has ended; implement the plan below, which is the current content of ${path} and may include the user's edits.`,
          '',
          plan,
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

export interface PlanMode {
  extension: ExtensionFactory
  /** Mode in effect for the current (or last) run. */
  readonly active: boolean
  readonly planPath: string
  /** Fires when `active` changes. */
  onChange(listener: (active: boolean) => void): () => void
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
  let planPath = ''
  const listeners = new Set<(active: boolean) => void>()
  const notify = () => {
    for (const listener of listeners) listener(state.active)
  }

  const extension: ExtensionFactory = (pi) => {
    function restore(ctx: ExtensionContext): void {
      planPath = planFilePath(ctx.sessionManager.getSessionId())
      const saved = ctx.sessionManager
        .getBranch()
        .filter(
          (entry): entry is CustomEntry<{ enabled?: boolean }> =>
            entry.type === 'custom' && entry.customType === ENTRY_TYPE,
        )
        .at(-1)
      next = saved?.data?.enabled === true
      // count 0 makes the next run repeat the full rules.
      state = { active: next, count: 0 }
      approved = false
      notify()
    }

    pi.on('session_start', (_event, ctx) => restore(ctx))
    pi.on('session_tree', (_event, ctx) => restore(ctx))

    pi.on('session_compact', () => {
      state = { ...state, count: 0 }
    })

    pi.on('tool_call', (event, ctx) => {
      if (!state.active || (event.toolName !== 'edit' && event.toolName !== 'write')) return
      if (isPlanFileWrite(event.input, ctx.cwd, planPath)) return
      return {
        block: true,
        reason: `Rejected: plan mode — the only editable file is ${planPath}`,
      }
    })

    pi.on('before_agent_start', () => {
      const plan = readPlan(planPath)
      const step = planStep(state, next, plan.length > 0, approved)
      approved = false
      const changed = step.state.active !== state.active
      if (changed) pi.appendEntry(ENTRY_TYPE, { enabled: step.state.active })
      state = step.state
      if (changed) notify()
      if (!step.reminder) return
      return {
        message: {
          customType: ENTRY_TYPE,
          content: reminderText(step.reminder, planPath, plan),
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
    get planPath() {
      return planPath
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
