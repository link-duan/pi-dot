import { getAgentDir, ProjectTrustStore } from '@earendil-works/pi-coding-agent'
import { app, BrowserWindow, dialog } from 'electron'
import { IPC } from '@shared/ipc'
import type { ConnectionStatus, StartResult } from '@shared/protocol'
import { AgentHost } from './agent-host'
import { projectCwd, withCwdLock } from './cwd'
import { addRecentProject } from './recent-projects'
import { trustDecision, trustResources } from './trust'
import { SerialQueue } from '@shared/queue'

type ConfirmKind = 'close' | 'quit' | 'change-folder'

export type AppWindow = {
  readonly window: BrowserWindow
  bind(cwd: string): Promise<StartResult>
  leave(): Promise<{ cancelled: boolean }>
  /** Asks again whether to trust the bound folder; rebinds it if the answer changed. */
  retrust(): Promise<StartResult>
  readonly host: AgentHost | null
  send(command: string): void
  focus(): void
}

const windows = new Map<number, HostedWindow>()
let quitting = false
let quitOp: Promise<void> | undefined

export function attach(window: BrowserWindow): AppWindow {
  return HostedWindow.attach(window)
}

export function from(sender: Electron.WebContents): AppWindow | null {
  const window = BrowserWindow.fromWebContents(sender)
  return window ? (windows.get(window.id) ?? null) : null
}

export function getWindows(): AppWindow[] {
  return [...windows.values()].filter((hosted) => !hosted.window.isDestroyed())
}

export function getFocusedWindow(): AppWindow | null {
  const window = BrowserWindow.getFocusedWindow()
  return window ? (windows.get(window.id) ?? null) : null
}

export function onBeforeQuit(event: Electron.Event): void {
  if (quitting) return
  event.preventDefault()
  void requestQuit()
}

function requestQuit(): Promise<void> {
  quitOp ??= (async () => {
    try {
      if (await HostedWindow.prepareQuit()) app.quit()
    } finally {
      if (!quitting) quitOp = undefined
    }
  })()
  return quitOp
}

class HostedWindow implements AppWindow {
  host: AgentHost | null = null
  private disposed = false
  private ops = new SerialQueue()

  private constructor(readonly window: BrowserWindow) {}

  static attach(window: BrowserWindow): HostedWindow {
    const hosted = new HostedWindow(window)
    windows.set(window.id, hosted)
    window.on('close', (event) => hosted.requestClose(event))
    window.on('closed', () => {
      windows.delete(window.id)
      void hosted.orphanStop()
    })
    return hosted
  }

  static async prepareQuit(): Promise<boolean> {
    if (
      !(await confirmStopRunning(
        getFocusedWindow()?.window ?? null,
        'quit',
        HostedWindow.totalRunning(),
      ))
    ) {
      return false
    }
    quitting = true
    await Promise.all([...windows.values()].map((hosted) => hosted.shutdown()))
    return true
  }

  bind(cwd: string): Promise<StartResult> {
    return this.ops.enqueue(() => this.bindOp(cwd))
  }

  leave(): Promise<{ cancelled: boolean }> {
    return this.ops.enqueue(() => this.leaveOp())
  }

  retrust(): Promise<StartResult> {
    return this.ops.enqueue(async () => {
      const host = this.host
      if (!host || !this.live()) return { kind: 'cancelled' }
      const trusted = await askTrust(this.window, host.cwd)
      if (trusted === host.trusted || this.host !== host) return { kind: 'cancelled' }
      return this.bindOp(host.cwd, trusted)
    })
  }

  send(command: string): void {
    if (this.window.isDestroyed()) return
    this.window.webContents.send(IPC.command, command)
  }

  focus(): void {
    if (this.window.isMinimized()) this.window.restore()
    this.window.show()
    this.window.focus()
  }

  private static owner(cwd: string): HostedWindow | undefined {
    for (const hosted of windows.values()) {
      if (hosted.occupies(cwd)) return hosted
    }
  }

  private static totalRunning(): number {
    let count = 0
    for (const hosted of windows.values()) count += hosted.runningCount()
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

  private requestClose(event: Electron.Event): void {
    if (this.disposed || quitting) return
    if (!this.host && this.ops.pending === 0) {
      this.disposed = true
      return
    }
    event.preventDefault()
    const skipConfirm = this.runningCount() === 0
    if (skipConfirm && !this.host) this.disposed = true
    void this.ops.enqueue(() => this.closeOp({ skipConfirm }))
  }

  private async closeOp(opts: { skipConfirm: boolean }): Promise<void> {
    if (
      !this.disposed &&
      !opts.skipConfirm &&
      !(await confirmStopRunning(this.window, 'close', this.runningCount()))
    ) {
      return
    }
    await this.withHostCwd(async () => {
      this.disposed = true
      await this.stopHost()
    })
    if (!this.window.isDestroyed()) this.window.close()
  }

  private async leaveOp(): Promise<{ cancelled: boolean }> {
    if (!this.live()) return { cancelled: true }
    if (!(await confirmStopRunning(this.window, 'change-folder', this.runningCount()))) {
      return { cancelled: true }
    }
    if (!this.live()) return { cancelled: true }
    await this.withHostCwd(() => this.stopHost())
    this.sendStatus('disconnected')
    return { cancelled: false }
  }

  private async bindOp(cwd: string, trust?: boolean): Promise<StartResult> {
    if (!this.live()) return { kind: 'cancelled' }
    const key = await projectCwd(cwd)
    if (!this.live()) return { kind: 'cancelled' }

    const occupied = HostedWindow.owner(key)
    if (occupied && occupied !== this) return this.yieldTo(occupied)

    if (
      this.host &&
      !(await confirmStopRunning(this.window, 'change-folder', this.runningCount()))
    ) {
      return { kind: 'cancelled' }
    }
    if (!this.live()) return { kind: 'cancelled' }

    const decision = trust === undefined ? trustDecision(key, getAgentDir()) : null
    const trusted =
      trust ?? (decision === 'ask' ? await askTrust(this.window, key) : decision === 'trusted')
    if (!this.live()) return { kind: 'cancelled' }

    return withCwdLock(key, async () => {
      if (!this.live()) return { kind: 'cancelled' }
      const taken = HostedWindow.owner(key)
      if (taken && taken !== this) return this.yieldTo(taken)

      if (this.host) await this.stopHost()
      if (!this.live()) return { kind: 'cancelled' }

      this.sendStatus('connecting')
      const next = new AgentHost(key, trusted)
      next.onEvent((event) => this.sendTo(IPC.event, event))
      try {
        await next.start()
        if (!this.live()) {
          await next.stop()
          return { kind: 'cancelled' }
        }
        this.host = next
        addRecentProject(key)
        this.setTitle()
        this.sendStatus('ready')
        return { kind: 'started', snapshot: next.snapshot() }
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
    await this.ops.drain()
    await this.withHostCwd(() => this.stopHost())
  }

  private async orphanStop(): Promise<void> {
    await this.withHostCwd(() => this.stopHost())
  }

  private yieldTo(other: HostedWindow): StartResult {
    other.focus()
    if (!this.host) void this.ops.enqueue(() => this.closeOp({ skipConfirm: true }))
    return { kind: 'focused' }
  }

  private withHostCwd<T>(fn: () => Promise<T>): Promise<T> {
    const cwd = this.host?.cwd
    return cwd ? withCwdLock(cwd, fn) : fn()
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

export type Rect = { x: number; y: number; width: number; height: number }

export function clampCascade(from: Rect, workArea: Rect, offset = 24): Rect {
  const width = Math.min(from.width, workArea.width)
  const height = Math.min(from.height, workArea.height)
  const maxX = workArea.x + workArea.width - width
  const maxY = workArea.y + workArea.height - height
  return {
    x: Math.min(Math.max(from.x + offset, workArea.x), maxX),
    y: Math.min(Math.max(from.y + offset, workArea.y), maxY),
    width,
    height,
  }
}

async function askTrust(window: BrowserWindow, cwd: string): Promise<boolean> {
  const found = trustResources(cwd)
  const result = await dialog.showMessageBox(window, {
    type: 'warning',
    buttons: ['Trust', "Don't Trust"],
    defaultId: 1,
    cancelId: 1,
    message: 'Trust this folder?',
    detail: [
      `${cwd} contains project resources that run code:`,
      ...(found.length > 0 ? [found.map((path) => `• ${path}`).join('   ')] : []),
      '',
      'Only trust folders you know.',
    ].join('\n'),
    checkboxLabel: 'Remember for this folder',
    checkboxChecked: true,
  })
  const trusted = result.response === 0
  if (result.checkboxChecked) new ProjectTrustStore(getAgentDir()).set(cwd, trusted)
  return trusted
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
