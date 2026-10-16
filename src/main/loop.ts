import { Type } from '@earendil-works/pi-ai'
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionFactory,
} from '@earendil-works/pi-coding-agent'
import {
  formatInterval,
  isLoopEdit,
  LOOP_MESSAGE_TYPE,
  SCHEDULE_WAKEUP_TOOL,
  type LoopRef,
  type LoopStart,
} from '@shared/protocol'

const MIN_WAIT_MS = 60_000
const MAX_WAIT_MS = 3_600_000
/** A self-paced loop's delay when the user writes before its first iteration picks one. */
const DEFAULT_WAIT_MS = 20 * 60_000

/**
 * Sent with every iteration of a self-paced loop, as Claude Code's `/loop` re-enters its skill on
 * each firing. Hidden messages reach the model as user text; the tag marks them as ours.
 */
const SELF_PACED_REMINDER = `<loop>
The user wants you to self-pace this loop. Decide what makes the next iteration worth running — a passage of time, or an observable event.
1. Run this message's task now.
2. If the task needs another iteration, call schedule_wakeup with:
   - delaySeconds: lean 1200–1800s; idle iterations more frequent than the task needs are pure overhead. Pick based on what you observed.
   - reason: one short sentence on why you picked that delay.
3. If it doesn't need another iteration, call schedule_wakeup with stop: true instead — re-arming is a per-turn choice, not a default. Before you stop, write a one-line outcome.
</loop>`

interface Loop {
  prompt: string
  ms: number
  /** The user set the interval; the loop repeats without the model. */
  fixed: boolean
  /** Why the model picked its delay, for a self-paced loop. */
  reason?: string
}

/** What the loop sends to run an iteration: its prompt, or the message that it changed. */
type Send = 'prompt' | 'edit'

/** What the loop does next. */
type Next =
  /** Idle, counting down to the next iteration. */
  | { kind: 'timer'; at: number; handle: ReturnType<typeof setTimeout> }
  /** A run is going; the loop sends once it settles. */
  | { kind: 'queued'; send: Send }
  /** Sent; the run it starts is an iteration. */
  | { kind: 'sent' }
  /** A run is going; the loop waits for it to settle. */
  | null

export interface LoopControl {
  extension: ExtensionFactory
  readonly ref: LoopRef
  /** Starts a loop and sends its prompt, replacing any running one; null stops it. */
  set(start: LoopStart | null): void
  /** Changes the running loop's prompt from now on, telling the model the user changed it. */
  edit(prompt: string): void
  onChange(listener: (ref: LoopRef) => void): () => void
}

export function createLoop(): LoopControl {
  let loop: Loop | null = null
  let next: Next = null
  /** The going run, kept across a failed run's retries; null while idle. */
  let run: { iteration: boolean; rearmed: boolean } | null = null
  /** A prompt change went out but its message is not in the session yet. */
  let editUnlanded = false
  let pi: ExtensionAPI | null = null
  const listeners = new Set<(ref: LoopRef) => void>()

  const ref = (): LoopRef =>
    loop && {
      prompt: loop.prompt,
      ms: loop.ms,
      fixed: loop.fixed,
      reason: loop.reason,
      nextAt: next?.kind === 'timer' ? next.at : null,
      editPending: editUnlanded,
    }
  const notify = () => {
    for (const listener of listeners) listener(ref())
  }

  const cancelTimer = () => {
    if (next?.kind !== 'timer') return
    clearTimeout(next.handle)
    next = null
  }
  const stop = () => {
    cancelTimer()
    loop = null
    next = null
    editUnlanded = false
    notify()
  }

  /** Sends what runs an iteration, built from the prompt as it is now. */
  const dispatch = (send: Send) => {
    if (send === 'prompt') return pi?.sendUserMessage(loop!.prompt)
    const content = `<loop>\nThe user changed this loop's prompt to:\n${loop!.prompt}\n</loop>`
    pi?.sendMessage(
      { customType: LOOP_MESSAGE_TYPE, content, display: true, details: { edited: true } },
      { triggerTurn: true },
    )
  }

  /**
   * Runs an iteration in a run of its own: only a new run passes before_agent_start, which
   * reminds a self-paced loop, so while a run is going the loop sends once it settles.
   */
  const send = (what: Send) => {
    if (run) {
      next = { kind: 'queued', send: what }
      return
    }
    cancelTimer()
    next = { kind: 'sent' }
    dispatch(what)
  }

  const wait = () => {
    const at = Date.now() + loop!.ms
    next = { kind: 'timer', at, handle: setTimeout(() => send('prompt'), loop!.ms) }
    notify()
  }

  const extension: ExtensionFactory = (api) => {
    pi = api

    api.registerTool({
      name: SCHEDULE_WAKEUP_TOOL,
      label: 'Schedule Wakeup',
      description: `Schedule when to resume work in a self-paced loop — the user started a loop without an interval, asking you to self-pace iterations of a specific task. To end the loop, call this tool with stop: true (omit every other field).

Picking delaySeconds (clamped to 60–3600): match the delay to what you're actually waiting for. A CI run that takes ~8 minutes deserves one ~480s check, not eight 60s ones. With no specific signal, default to 1200–1800s.`,
      parameters: Type.Object({
        delaySeconds: Type.Optional(
          Type.Number({
            description: 'Seconds from now to the next iteration. Required unless stop is true.',
          }),
        ),
        reason: Type.Optional(
          Type.String({
            description:
              "One short sentence on what you chose and why, shown to the user; 'watching CI run' beats 'waiting'.",
          }),
        ),
        stop: Type.Optional(Type.Boolean({ description: 'End the loop; omit every other field.' })),
      }),
      // `ms` is the delay the loop settled on, for the transcript.
      async execute(_toolCallId, params): Promise<AgentToolResult<{ ms?: number }>> {
        if (!loop || loop.fixed) throw new Error('No self-paced loop is running.')
        if (params.stop) {
          stop()
          return { content: [{ type: 'text', text: 'The loop ended.' }], details: {} }
        }
        if (params.delaySeconds === undefined) {
          throw new Error('delaySeconds is required unless stop is true.')
        }
        const ms = Math.round(params.delaySeconds) * 1000
        loop.ms = Math.min(MAX_WAIT_MS, Math.max(MIN_WAIT_MS, ms))
        loop.reason = params.reason
        if (run) run.rearmed = true
        notify()
        const text = `Next iteration in ${formatInterval(loop.ms)} after this one ends.`
        return { content: [{ type: 'text', text }], details: { ms: loop.ms } }
      },
    })

    api.on('session_start', () => {
      // Always declared, so the loadout (and prompt cache) never changes with the loop.
      const tools = api.getActiveTools()
      if (!tools.includes(SCHEDULE_WAKEUP_TOOL))
        api.setActiveTools([...tools, SCHEDULE_WAKEUP_TOOL])
    })

    api.on('before_agent_start', () => {
      const iteration = next?.kind === 'sent'
      if (iteration) next = null
      run = { iteration, rearmed: false }
      // A fixed interval repeats the prompt as is, like a cron job; only self-pacing needs rules.
      if (!iteration || !loop || loop.fixed) return
      return {
        message: { customType: LOOP_MESSAGE_TYPE, content: SELF_PACED_REMINDER, display: false },
      }
    })

    api.on('agent_start', () => {
      // A retry starts again within the same run; a run without before_agent_start is not ours.
      run ??= { iteration: false, rearmed: false }
      if (next?.kind !== 'timer') return
      // Something else ran while the loop waited; it waits afresh once that settles.
      cancelTimer()
      notify()
    })

    api.on('message_start', (event) => {
      if (!editUnlanded || !isLoopEdit(event.message)) return
      editUnlanded = false
      notify()
    })

    // Settled, not agent_end: a failed run that retries, or a queued follow-up, is still this run.
    api.on('agent_settled', () => {
      const ended = run
      run = null
      if (!loop) return
      if (next?.kind === 'queued') return send(next.send)
      // An iteration that didn't re-arm ends the loop; a message the user wrote in between keeps it.
      if (!loop.fixed && ended?.iteration && !ended.rearmed) return stop()
      wait()
    })

    api.on('session_shutdown', cancelTimer)
  }

  return {
    extension,
    get ref() {
      return ref()
    },
    set(start) {
      if (!start) return stop()
      loop = { prompt: start.prompt, ms: start.ms ?? DEFAULT_WAIT_MS, fixed: start.ms !== null }
      editUnlanded = false
      send('prompt')
      notify()
    },
    edit(prompt) {
      if (!loop) return
      loop.prompt = prompt
      // The first prompt, still waiting for a run to settle, simply goes out changed.
      if (next?.kind !== 'queued' || next.send !== 'prompt') {
        editUnlanded = true
        send('edit')
      }
      notify()
    },
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
