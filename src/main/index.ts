import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, screen, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type { StartResult, ThinkingLevel } from '@shared/protocol'
import appIcon from '../../resources/icon-dock.png?asset'
import { applyAgentEnv } from './agent-env'
import { saveClipboardImage } from './clipboard-image'
import {
  attach,
  eachWindow,
  from,
  fromOrNull,
  lastWindow,
  onBeforeQuit,
  sendToFocused,
} from './frames'
import { readLastCwd } from './last-cwd'
import { searchProjectFiles } from './search-files'
import { listProjectSessions, withRunning } from './sessions'
import { statPaths } from './stat-paths'
import { clampCascade } from './windows'

if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? '#09090b' : '#ffffff'
}

function requireSession(event: Electron.IpcMainInvokeEvent) {
  const session = from(event.sender).session
  if (!session) throw new Error('No active session')
  return session
}

function focusAnyWindow(): void {
  const window = BrowserWindow.getFocusedWindow() ?? lastWindow()
  if (!window) {
    createWindow()
    return
  }
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

function createWindow(): BrowserWindow {
  const source = lastWindow()
  const cascaded = source
    ? clampCascade(source.getBounds(), screen.getDisplayMatching(source.getBounds()).workArea)
    : null
  const window = new BrowserWindow({
    width: cascaded?.width ?? 960,
    height: cascaded?.height ?? 740,
    ...(cascaded ? { x: cascaded.x, y: cascaded.y } : {}),
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

  attach(window)

  window.on('ready-to-show', () => {
    if (!window.isDestroyed()) window.show()
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

  return window
}

function installMenu(): void {
  const isMac = process.platform === 'darwin'
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: 'appMenu' as const }] : []),
      {
        label: 'File',
        submenu: [
          {
            label: 'New Session',
            accelerator: 'CmdOrCtrl+N',
            click: () => sendToFocused('newSession'),
          },
          {
            label: 'New Window',
            accelerator: 'CmdOrCtrl+Shift+N',
            click: () => createWindow(),
          },
          { type: 'separator' },
          { role: 'close' },
          ...(!isMac ? [{ type: 'separator' as const }, { role: 'quit' as const }] : []),
        ],
      },
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

function registerIpc(): void {
  ipcMain.handle(IPC.chooseFolder, async (event) => {
    const result = await dialog.showOpenDialog(from(event.sender).window, {
      title: 'Choose working directory',
      properties: ['openDirectory'],
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle(IPC.getLastCwd, () => readLastCwd())

  ipcMain.handle(IPC.getSnapshot, (event) => fromOrNull(event.sender)?.snapshot() ?? null)

  ipcMain.handle(IPC.start, async (event, cwd: string): Promise<StartResult> => {
    if (typeof cwd !== 'string' || !cwd) throw new Error('Invalid cwd')
    return from(event.sender).bind(cwd)
  })

  ipcMain.handle(IPC.stop, async (event) => from(event.sender).leave())

  ipcMain.handle(IPC.prompt, async (event, text: string) => {
    await requireSession(event).prompt(text)
  })

  ipcMain.handle(IPC.abort, async (event) => {
    await fromOrNull(event.sender)?.session?.abort()
  })

  ipcMain.handle(IPC.setModel, async (event, provider: string, modelId: string) => {
    return requireSession(event).setModel(provider, modelId)
  })

  ipcMain.handle(IPC.setThinkingLevel, async (event, level: ThinkingLevel) => {
    return requireSession(event).setThinkingLevel(level)
  })

  ipcMain.handle(IPC.listSessions, async (event, cwd: string) => {
    if (typeof cwd !== 'string' || !cwd) return []
    const items = await listProjectSessions(cwd)
    const session = fromOrNull(event.sender)?.session
    if (!session || session.cwd !== cwd) return items
    return withRunning(items, session.runningSessionFiles())
  })

  ipcMain.handle(IPC.switchSession, async (event, sessionPath: string) => {
    const window = from(event.sender)
    const { cancelled } = await requireSession(event).switchSession(sessionPath)
    if (cancelled) throw new Error('Session switch cancelled')
    const snapshot = window.snapshot()
    if (!snapshot) throw new Error('No active session')
    return snapshot
  })

  ipcMain.handle(IPC.newSession, async (event) => {
    const window = from(event.sender)
    const { cancelled } = await requireSession(event).newSession()
    if (cancelled) throw new Error('New session cancelled')
    const snapshot = window.snapshot()
    if (!snapshot) throw new Error('No active session')
    return snapshot
  })

  ipcMain.handle(IPC.openExternal, async (_event, url: string) => {
    if (!/^https?:\/\//.test(url)) return
    await shell.openExternal(url)
  })

  ipcMain.handle(IPC.searchFiles, async (_event, cwd: string, query: string) => {
    if (typeof cwd !== 'string' || !cwd) return []
    return searchProjectFiles(cwd, typeof query === 'string' ? query : '')
  })

  ipcMain.handle(IPC.statPaths, async (_event, paths: string[]) => {
    if (!Array.isArray(paths)) return []
    return statPaths(paths.filter((path): path is string => typeof path === 'string'))
  })

  ipcMain.handle(IPC.saveClipboardImage, async (_event, data: Uint8Array, mimeType: string) => {
    if (!data || typeof mimeType !== 'string') throw new Error('Invalid image')
    return saveClipboardImage(data, mimeType)
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    focusAnyWindow()
  })

  app.whenReady().then(() => {
    applyAgentEnv()
    app.setName('Pi Dot')
    app.dock?.setIcon(appIcon)
    installMenu()
    registerIpc()
    createWindow()

    nativeTheme.on('updated', () => {
      const color = windowBackground()
      eachWindow((window) => window.setBackgroundColor(color))
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

  app.on('before-quit', onBeforeQuit)
}
