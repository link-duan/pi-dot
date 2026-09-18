import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type { ConnectionStatus, SessionSnapshot, ThinkingLevel } from '@shared/protocol'
import appIcon from '../../resources/icon-dock.png?asset'
import { applyAgentEnv } from './agent-env'
import { AgentHost } from './agent-host'
import { readLastCwd, writeLastCwd } from './last-cwd'
import { listProjectSessions, withRunning } from './sessions'

if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

let window: BrowserWindow | null = null
let host: AgentHost | null = null
let allowClose = false
let isQuitting = false
let confirming = false

function sendStatus(status: ConnectionStatus, error?: string): void {
  window?.webContents.send(IPC.status, status, error)
}

function sendEvent(event: unknown): void {
  window?.webContents.send(IPC.event, event)
}

async function stopHost(): Promise<void> {
  const current = host
  host = null
  if (current) {
    await current.stop()
  }
}

function runningCount(): number {
  return host?.runningSessionFiles().length ?? 0
}

async function confirmStopRunning(kind: 'close' | 'quit'): Promise<boolean> {
  const count = runningCount()
  if (count === 0) return true
  const owner = window
  if (!owner) return true
  const result = await dialog.showMessageBox(owner, {
    type: 'warning',
    buttons: ['Cancel', kind === 'quit' ? 'Stop and quit' : 'Stop and close'],
    defaultId: 0,
    cancelId: 0,
    message: count === 1 ? 'A session is still running.' : `${count} sessions are still running.`,
    detail: 'Closing now will stop running work.',
  })
  return result.response === 1
}

function confirmThen(kind: 'close' | 'quit', proceed: () => Promise<void>): void {
  if (confirming) return
  confirming = true
  void (async () => {
    try {
      if (!(await confirmStopRunning(kind))) return
      allowClose = true
      if (kind === 'quit') isQuitting = true
      await stopHost()
      await proceed()
    } finally {
      confirming = false
    }
  })()
}

function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? '#09090b' : '#ffffff'
}

function installMenu(): void {
  const isMac = process.platform === 'darwin'
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: 'appMenu' as const }] : []),
      { role: 'fileMenu' },
      { role: 'editMenu' },
      {
        label: 'View',
        submenu: [
          { role: 'reload', accelerator: isMac ? 'Cmd+R' : 'F5' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      { role: 'windowMenu' },
    ]),
  )
}

function snapshotOf(next: AgentHost): SessionSnapshot {
  return {
    cwd: next.cwd,
    state: next.getState(),
    messages: next.getMessages(),
    messagePersistedAt: next.getMessagePersistedAt(),
    models: next.getAvailableModels(),
    thinkingLevels: next.getAvailableThinkingLevels(),
    runningSessionFiles: next.runningSessionFiles(),
  }
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 960,
    height: 740,
    minWidth: 720,
    minHeight: 560,
    title: 'Pi Dot',
    icon: appIcon,
    show: false,
    backgroundColor: windowBackground(),
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    // 12px lights, vertically centered in the 36px (h-9) overlay with the session history icon
    trafficLightPosition: { x: 18, y: 12 },
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  window.on('ready-to-show', () => window?.show())
  window.on('close', (event) => {
    if (allowClose || isQuitting) return
    if (runningCount() === 0) return
    event.preventDefault()
    confirmThen('close', async () => {
      window?.close()
    })
  })
  window.on('closed', () => {
    window = null
    if (!isQuitting) allowClose = false
  })
  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.chooseFolder, async () => {
    const result = await dialog.showOpenDialog(window!, {
      title: 'Choose working directory',
      properties: ['openDirectory'],
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle(IPC.getLastCwd, () => readLastCwd())

  ipcMain.handle(IPC.getSnapshot, () => (host ? snapshotOf(host) : null))

  ipcMain.handle(IPC.start, async (_event, cwd: string): Promise<SessionSnapshot> => {
    await stopHost()
    sendStatus('connecting')
    const next = new AgentHost(cwd)
    next.onEvent((event) => sendEvent(event))
    try {
      await next.start()
      const snapshot = snapshotOf(next)
      host = next
      writeLastCwd(cwd)
      window?.setTitle(`Pi Dot — ${cwd}`)
      sendStatus('ready')
      return snapshot
    } catch (error) {
      await next.stop()
      const message = error instanceof Error ? error.message : String(error)
      sendStatus('error', message)
      throw error
    }
  })

  ipcMain.handle(IPC.stop, async () => {
    await stopHost()
    sendStatus('disconnected')
  })

  ipcMain.handle(IPC.prompt, async (_event, text: string) => {
    if (!host) throw new Error('No active session')
    await host.prompt(text)
  })

  ipcMain.handle(IPC.abort, async () => {
    if (!host) return
    await host.abort()
  })

  ipcMain.handle(IPC.setModel, async (_event, provider: string, modelId: string) => {
    if (!host) throw new Error('No active session')
    return host.setModel(provider, modelId)
  })

  ipcMain.handle(IPC.setThinkingLevel, async (_event, level: ThinkingLevel) => {
    if (!host) throw new Error('No active session')
    return host.setThinkingLevel(level)
  })

  ipcMain.handle(IPC.listSessions, async (_event, cwd: string) => {
    if (typeof cwd !== 'string' || !cwd) return []
    const items = await listProjectSessions(cwd)
    if (!host || host.cwd !== cwd) return items
    return withRunning(items, host.runningSessionFiles())
  })

  ipcMain.handle(IPC.switchSession, async (_event, sessionPath: string) => {
    if (!host) throw new Error('No active session')
    const { cancelled } = await host.switchSession(sessionPath)
    if (cancelled) throw new Error('Session switch cancelled')
    return snapshotOf(host)
  })

  ipcMain.handle(IPC.newSession, async () => {
    if (!host) throw new Error('No active session')
    const { cancelled } = await host.newSession()
    if (cancelled) throw new Error('New session cancelled')
    return snapshotOf(host)
  })

  ipcMain.handle(IPC.openExternal, async (_event, url: string) => {
    if (!/^https?:\/\//.test(url)) return
    await shell.openExternal(url)
  })
}

app.whenReady().then(() => {
  applyAgentEnv()
  app.setName('Pi Dot')
  app.dock?.setIcon(appIcon)
  installMenu()
  registerIpc()
  createWindow()

  nativeTheme.on('updated', () => {
    window?.setBackgroundColor(windowBackground())
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  if (isQuitting) return
  event.preventDefault()
  if (runningCount() > 0) {
    confirmThen('quit', async () => {
      app.quit()
    })
    return
  }
  isQuitting = true
  allowClose = true
  void stopHost().then(() => app.quit())
})
