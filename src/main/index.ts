import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, screen, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type { StartResult, ThinkingLevel } from '@shared/protocol'
import type { SettingsPatch } from '@shared/settings'
import appIcon from '../../resources/icon-dock.png?asset'
import { applyAgentEnv } from './agent-env'
import { saveClipboardImage } from './clipboard-image'
import { readLastCwd } from './last-cwd'
import { searchProjectFiles } from './search-files'
import { listProjectSessions, withRunning } from './sessions'
import { statPaths } from './stat-paths'
import {
  cancelLogin,
  getCatalog,
  getSettings,
  logoutProvider,
  patchSettings,
  readModelsFileText,
  respondLogin,
  startLogin,
  writeModelsFileText,
} from './settings-host'
import { attach, clampCascade, from, getFocusedWindow, getWindows, onBeforeQuit } from './window'

if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? '#09090b' : '#ffffff'
}

function requireWindow(event: Electron.IpcMainInvokeEvent) {
  const window = from(event.sender)
  if (!window) throw new Error('No window')
  return window
}

function requireHost(event: Electron.IpcMainInvokeEvent) {
  const host = requireWindow(event).host
  if (!host) throw new Error('No active session')
  return host
}

function focusAnyWindow(): void {
  const hosted = getFocusedWindow() ?? getWindows().at(-1)
  if (!hosted) {
    createWindow()
    return
  }
  hosted.focus()
}

function createWindow(): BrowserWindow {
  const source = getWindows().at(-1)?.window
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
  const settingsItem = {
    label: 'Settings…',
    accelerator: 'CmdOrCtrl+,',
    click: () => getFocusedWindow()?.send('openSettings'),
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac
        ? [
            {
              label: app.name,
              submenu: [
                { role: 'about' as const },
                { type: 'separator' as const },
                settingsItem,
                { type: 'separator' as const },
                { role: 'hide' as const },
                { role: 'hideOthers' as const },
                { role: 'unhide' as const },
                { type: 'separator' as const },
                { role: 'quit' as const },
              ],
            },
          ]
        : []),
      {
        label: 'File',
        submenu: [
          {
            label: 'New Session',
            accelerator: 'CmdOrCtrl+N',
            click: () => getFocusedWindow()?.send('newSession'),
          },
          {
            label: 'New Window',
            accelerator: 'CmdOrCtrl+Shift+N',
            click: () => createWindow(),
          },
          { type: 'separator' },
          { role: 'close' },
          ...(!isMac
            ? [
                { type: 'separator' as const },
                settingsItem,
                { type: 'separator' as const },
                { role: 'quit' as const },
              ]
            : []),
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
    const result = await dialog.showOpenDialog(requireWindow(event).window, {
      title: 'Choose working directory',
      properties: ['openDirectory'],
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle(IPC.getLastCwd, () => readLastCwd())

  ipcMain.handle(IPC.getSnapshot, (event) => from(event.sender)?.host?.snapshot() ?? null)

  ipcMain.handle(IPC.start, async (event, cwd: string): Promise<StartResult> => {
    if (typeof cwd !== 'string' || !cwd) throw new Error('Invalid cwd')
    return requireWindow(event).bind(cwd)
  })

  ipcMain.handle(IPC.stop, async (event) => requireWindow(event).leave())

  ipcMain.handle(IPC.prompt, async (event, text: string) => {
    await requireHost(event).prompt(text)
  })

  ipcMain.handle(IPC.abort, async (event) => {
    await from(event.sender)?.host?.abort()
  })

  ipcMain.handle(IPC.setModel, async (event, provider: string, modelId: string) => {
    return requireHost(event).setModel(provider, modelId)
  })

  ipcMain.handle(IPC.setThinkingLevel, async (event, level: ThinkingLevel) => {
    return requireHost(event).setThinkingLevel(level)
  })

  ipcMain.handle(IPC.listSessions, async (event, cwd: string) => {
    if (typeof cwd !== 'string' || !cwd) return []
    const items = await listProjectSessions(cwd)
    const host = from(event.sender)?.host
    if (!host || host.cwd !== cwd) return items
    return withRunning(items, host.runningSessionFiles())
  })

  ipcMain.handle(IPC.switchSession, async (event, sessionPath: string) => {
    return requireHost(event).switchSession(sessionPath)
  })

  ipcMain.handle(IPC.newSession, async (event) => {
    return requireHost(event).newSession()
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

  ipcMain.handle(IPC.getSettings, (event) => getSettings(from(event.sender)?.host?.cwd))

  ipcMain.handle(IPC.patchSettings, (event, patch: SettingsPatch) => {
    return patchSettings(from(event.sender)?.host?.cwd, patch)
  })

  ipcMain.handle(IPC.getModelsFile, () => readModelsFileText())

  ipcMain.handle(IPC.setModelsFile, (_event, text: string) => {
    if (typeof text !== 'string') throw new Error('Invalid models.json')
    return writeModelsFileText(text)
  })

  ipcMain.handle(IPC.getCatalog, () => getCatalog())

  ipcMain.handle(IPC.login, async (event, providerId: string, type: 'api_key' | 'oauth') => {
    if (typeof providerId !== 'string' || (type !== 'api_key' && type !== 'oauth')) {
      throw new Error('Invalid login')
    }
    await startLogin(event.sender, providerId, type)
  })

  ipcMain.handle(IPC.loginRespond, (event, id: string, value: string) => {
    if (typeof id !== 'string' || typeof value !== 'string') return
    respondLogin(event.sender.id, id, value)
  })

  ipcMain.handle(IPC.loginCancel, (event) => {
    cancelLogin(event.sender.id)
  })

  ipcMain.handle(IPC.logout, async (_event, providerId: string) => {
    if (typeof providerId !== 'string') throw new Error('Invalid provider')
    await logoutProvider(providerId)
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
      for (const hosted of getWindows()) hosted.window.setBackgroundColor(color)
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
