import { app, BrowserWindow, dialog } from 'electron'
import { IPC } from '@shared/ipc'
import type { ConnectionStatus, SessionSnapshot, StartResult } from '@shared/protocol'
import { AgentHost } from './agent-host'
import { writeLastCwd } from './last-cwd'
import { projectCwd, withCwdLock } from './windows'

type ConfirmKind = 'close' | 'quit' | 'change-folder'

export type AppWindow = {
  readonly window: BrowserWindow
  bind(cwd: string): Promise<StartResult>
  leave(): Promise<{ cancelled: boolean }>
  readonly session: AgentHost | null
  snapshot(): SessionSnapshot | null
  send(command: string): void
}

const frames = new Map<number, Frame>()
let quitting = false
let quitOp: Promise<void> | undefined

export function attach(window: BrowserWindow): AppWindow {
  return Frame.attach(window)
}

export function from(sender: Electron.WebContents): AppWindow {
  const frame = fromOrNull(sender)
  if (!frame) throw new Error('No window')
  return frame
}

export function fromOrNull(sender: Electron.WebContents): AppWindow | null {
  const window = BrowserWindow.fromWebContents(sender)
  return window ? (frames.get(window.id) ?? null) : null
}

export function lastWindow(): BrowserWindow | undefined {
  return [...frames.values()].at(-1)?.window
}

export function eachWindow(fn: (window: BrowserWindow) => void): void {
  for (const frame of frames.values()) {
    if (!frame.window.isDestroyed()) fn(frame.window)
  }
}

export function sendToFocused(command: string): void {
  const window = BrowserWindow.getFocusedWindow()
  const frame = window ? frames.get(window.id) : undefined
  frame?.send(command)
}

export function onBeforeQuit(event: Electron.Event): void {
  if (quitting) return
  event.preventDefault()
  void requestQuit()
}

function requestQuit(): Promise<void> {
  quitOp ??= (async () => {
    try {
      if (await Frame.prepareQuit()) app.quit()
    } finally {
      if (!quitting) quitOp = undefined
    }
  })()
  return quitOp
}

class Frame implements AppWindow {
  private host: AgentHost | null = null
  private disposed = false
  private queue: Promise<unknown> = Promise.resolve()
  private depth = 0

  private constructor(readonly window: BrowserWindow) {}

  static attach(window: BrowserWindow): Frame {
    const frame = new Frame(window)
    frames.set(window.id, frame)
    window.on('close', (event) => frame.requestClose(event))
    window.on('closed', () => {
      frames.delete(window.id)
      void frame.orphanStop()
    })
    return frame
  }

  static async prepareQuit(): Promise<boolean> {
    if (
      !(await confirmStopRunning(BrowserWindow.getFocusedWindow(), 'quit', Frame.totalRunning()))
    ) {
      return false
    }
    quitting = true
    await Promise.all([...frames.values()].map((frame) => frame.shutdown()))
    return true
  }

  get session(): AgentHost | null {
    return this.host
  }

  bind(cwd: string): Promise<StartResult> {
    return this.enqueue(() => this.bindOp(cwd))
  }

  leave(): Promise<{ cancelled: boolean }> {
    return this.enqueue(() => this.leaveOp())
  }

  snapshot(): SessionSnapshot | null {
    return this.host ? snapshotOf(this.host) : null
  }

  send(command: string): void {
    if (!this.host || this.window.isDestroyed()) return
    this.window.webContents.send(IPC.command, command)
  }

  private static owner(cwd: string): Frame | undefined {
    for (const frame of frames.values()) {
      if (frame.occupies(cwd)) return frame
    }
  }

  private static totalRunning(): number {
    let count = 0
    for (const frame of frames.values()) count += frame.runningCount()
    return count
  }

  private occupies(cwd: string): boolean {
    return !this.disposed && this.host?.cwd === cwd
  }

  private live(): boolean {
    return !this.disposed && !quitting
  }

  private runningCount(): number {
    return this.host?.runningSessionFiles().length ?? 0
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    this.depth++
    const run = this.queue.then(fn, fn)
    this.queue = run.then(
      () => undefined,
      () => undefined,
    )
    void run.finally(() => {
      this.depth--
    })
    return run
  }

  private requestClose(event: Electron.Event): void {
    if (this.disposed || quitting) return
    if (!this.host && this.depth === 0) {
      this.disposed = true
      return
    }
    event.preventDefault()
    const skipConfirm = this.runningCount() === 0
    if (skipConfirm && !this.host) this.disposed = true
    void this.enqueue(() => this.closeOp({ skipConfirm }))
  }

  private async closeOp(opts: { skipConfirm: boolean }): Promise<void> {
    if (
      !this.disposed &&
      !opts.skipConfirm &&
      !(await confirmStopRunning(this.window, 'close', this.runningCount()))
    ) {
      return
    }
    const cwd = this.host?.cwd
    if (cwd) {
      await withCwdLock(cwd, async () => {
        this.disposed = true
        await this.stopHost()
      })
    } else {
      this.disposed = true
      await this.stopHost()
    }
    if (!this.window.isDestroyed()) this.window.close()
  }

  private async leaveOp(): Promise<{ cancelled: boolean }> {
    if (!this.live()) return { cancelled: true }
    if (!(await confirmStopRunning(this.window, 'change-folder', this.runningCount()))) {
      return { cancelled: true }
    }
    if (!this.live()) return { cancelled: true }
    const cwd = this.host?.cwd
    if (cwd) await withCwdLock(cwd, () => this.stopHost())
    else await this.stopHost()
    this.sendStatus('disconnected')
    return { cancelled: false }
  }

  private async bindOp(cwd: string): Promise<StartResult> {
    if (!this.live()) return { kind: 'cancelled' }
    const key = await projectCwd(cwd)
    if (!this.live()) return { kind: 'cancelled' }

    const occupied = Frame.owner(key)
    if (occupied && occupied !== this) {
      occupied.focus()
      if (!this.host) void this.enqueue(() => this.closeOp({ skipConfirm: true }))
      return { kind: 'focused' }
    }

    if (
      this.host &&
      !(await confirmStopRunning(this.window, 'change-folder', this.runningCount()))
    ) {
      return { kind: 'cancelled' }
    }
    if (!this.live()) return { kind: 'cancelled' }

    return withCwdLock(key, async () => {
      if (!this.live()) return { kind: 'cancelled' }
      const taken = Frame.owner(key)
      if (taken && taken !== this) {
        taken.focus()
        if (!this.host) void this.enqueue(() => this.closeOp({ skipConfirm: true }))
        return { kind: 'focused' }
      }

      if (this.host) await this.stopHost()
      if (!this.live()) return { kind: 'cancelled' }

      this.sendStatus('connecting')
      const next = new AgentHost(key)
      next.onEvent((event) => this.sendTo(IPC.event, event))
      try {
        await next.start()
        if (!this.live()) {
          await next.stop()
          return { kind: 'cancelled' }
        }
        this.host = next
        writeLastCwd(key)
        this.setTitle()
        this.sendStatus('ready')
        return { kind: 'started', snapshot: snapshotOf(next) }
      } catch (error) {
        await next.stop()
        const message = error instanceof Error ? error.message : String(error)
        this.sendStatus('error', message)
        throw error
      }
    })
  }

  private async shutdown(): Promise<void> {
    this.disposed = true
    await this.queue
    const cwd = this.host?.cwd
    if (cwd) await withCwdLock(cwd, () => this.stopHost())
    else await this.stopHost()
  }

  private async orphanStop(): Promise<void> {
    const cwd = this.host?.cwd
    if (!cwd) return
    await withCwdLock(cwd, () => this.stopHost())
  }

  private async stopHost(): Promise<void> {
    const current = this.host
    if (!current) return
    try {
      await current.stop()
    } finally {
      if (this.host === current) this.host = null
      this.setTitle()
    }
  }

  private focus(): void {
    if (this.window.isMinimized()) this.window.restore()
    this.window.show()
    this.window.focus()
  }

  private setTitle(): void {
    if (this.window.isDestroyed()) return
    this.window.setTitle(this.host ? `Pi Dot — ${this.host.cwd}` : 'Pi Dot')
  }

  private sendTo(channel: string, ...args: unknown[]): void {
    if (this.window.isDestroyed()) return
    this.window.webContents.send(channel, ...args)
  }

  private sendStatus(status: ConnectionStatus, error?: string): void {
    this.sendTo(IPC.status, status, error)
  }
}

function snapshotOf(host: AgentHost): SessionSnapshot {
  return {
    cwd: host.cwd,
    state: host.getState(),
    messages: host.getMessages(),
    messagePersistedAt: host.getMessagePersistedAt(),
    models: host.getAvailableModels(),
    thinkingLevels: host.getAvailableThinkingLevels(),
    runningSessionFiles: host.runningSessionFiles(),
    skills: host.getSkills(),
    contextUsage: host.getContextUsage(),
  }
}

async function confirmStopRunning(
  ownerWindow: BrowserWindow | null,
  kind: ConfirmKind,
  count: number,
): Promise<boolean> {
  if (count === 0) return true
  const copy = {
    quit: { proceed: 'Stop and quit', detail: 'Quitting now will stop running work.' },
    close: { proceed: 'Stop and close', detail: 'Closing now will stop running work.' },
    'change-folder': {
      proceed: 'Stop and change folder',
      detail: 'Changing folder now will stop running work.',
    },
  }[kind]
  const options = {
    type: 'warning' as const,
    buttons: ['Cancel', copy.proceed],
    defaultId: 0,
    cancelId: 0,
    message: count === 1 ? 'A session is still running.' : `${count} sessions are still running.`,
    detail: copy.detail,
  }
  const result =
    ownerWindow && !ownerWindow.isDestroyed()
      ? await dialog.showMessageBox(ownerWindow, options)
      : await dialog.showMessageBox(options)
  return result.response === 1
}
