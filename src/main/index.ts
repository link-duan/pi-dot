import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  screen,
  shell,
} from 'electron'
import { IPC } from '@shared/ipc'
import type {
  AskReply,
  LoopStart,
  MessageRef,
  StartResult,
  ThinkingLevel,
  UiResponse,
} from '@shared/protocol'
import type { GeneralChange, ModelSettingsPatch } from '@shared/settings'
import appIcon from '../../resources/icon.png?asset'
import devIcon from '../../resources/icon-dev.png?asset'
import type { AgentHost } from './agent-host'
import { applyAgentEnv } from './agent-env'
import { saveClipboardImage } from './clipboard-image'
import { resolveImagePath } from './image-preview'
import { isInPlansDir, readPlan } from './plan-mode'
import { readRecentProjects, removeRecentProject } from './recent-projects'
import { searchProjectFiles } from './search-files'
import { listProjectSessions, withRunning } from './sessions'
import { statPaths } from './stat-paths'
import {
  cancelLogin,
  getCatalog,
  getGeneralSettings,
  getModelSettings,
  logoutProvider,
  patchGeneralSettings,
  patchModelSettings,
  readModelsFileText,
  respondLogin,
  startLogin,
  testProvider,
  writeModelsFileText,
  type SettingsFolder,
} from './settings-host'
import { attach, clampCascade, from, getFocusedWindow, getWindows, onBeforeQuit } from './window'

const APP_NAME = app.isPackaged ? 'Pi Dot' : 'Pi Dot Dev'
/** The dev build's icon is on graphite, to tell it from the installed app. */
const APP_ICON = app.isPackaged ? appIcon : devIcon

if (!app.isPackaged) {
  // Its own data folder, so the dev build holds its own single-instance lock beside the installed app.
  app.setPath('userData', join(app.getPath('appData'), APP_NAME))
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

function settingsFolder(sender: Electron.WebContents): SettingsFolder | null {
  const host = from(sender)?.host
  return host ? { cwd: host.cwd, trusted: host.trusted } : null
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
    icon: APP_ICON,
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
          ...(import.meta.env.DEV
            ? [
                {
                  label: 'Playground',
                  click: () => getFocusedWindow()?.send('openPlayground'),
                },
              ]
            : []),
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
  function handleHost<A extends unknown[], R>(
    channel: string,
    fn: (host: AgentHost, ...args: A) => Promise<R> | R,
  ): void {
    ipcMain.handle(channel, (event, ...args: unknown[]) => fn(requireHost(event), ...(args as A)))
  }

  ipcMain.handle(IPC.chooseFolder, async (event) => {
    const result = await dialog.showOpenDialog(requireWindow(event).window, {
      title: 'Choose working directory',
      properties: ['openDirectory'],
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle(IPC.getRecentProjects, () => readRecentProjects())
  ipcMain.handle(IPC.removeRecentProject, (_event, cwd: string) => removeRecentProject(cwd))

  ipcMain.handle(IPC.getSnapshot, (event) => from(event.sender)?.host?.snapshot() ?? null)

  ipcMain.handle(IPC.start, async (event, cwd: string): Promise<StartResult> => {
    if (typeof cwd !== 'string' || !cwd) throw new Error('Invalid cwd')
    return requireWindow(event).bind(cwd)
  })

  ipcMain.handle(IPC.stop, async (event) => requireWindow(event).leave())

  handleHost(IPC.prompt, (host, text: string, sessionFile: string, planMode: boolean) =>
    host.prompt(text, sessionFile, planMode === true),
  )
  handleHost(IPC.approvePlan, (host, sessionFile: string, message: string) =>
    host.approvePlan(sessionFile, message),
  )
  handleHost(IPC.setLoop, (host, sessionFile: string, loop: LoopStart | null) =>
    host.setLoop(sessionFile, loop),
  )
  handleHost(IPC.editLoop, (host, sessionFile: string, prompt: string) =>
    host.editLoop(sessionFile, prompt),
  )
  handleHost(IPC.answerQuestion, (host, sessionFile: string, toolCallId: string, reply: AskReply) =>
    host.answerQuestion(sessionFile, toolCallId, reply),
  )
  handleHost(IPC.respondUi, (host, sessionFile: string, id: string, response: UiResponse) =>
    host.respondUi(sessionFile, id, response),
  )
  ipcMain.handle(IPC.retrust, (event) => requireWindow(event).retrust())
  handleHost(IPC.editMessage, (host, sessionFile: string, timestamp: number) =>
    host.editMessage(sessionFile, timestamp),
  )
  handleHost(IPC.renameSession, (host, sessionFile: string, name: string) =>
    host.renameSession(sessionFile, name),
  )
  handleHost(IPC.messagePlanMode, (host, sessionFile: string, timestamp: number) =>
    host.messagePlanMode(sessionFile, timestamp),
  )
  handleHost(IPC.restoreLeaf, (host, sessionFile: string, leafId: string) =>
    host.restoreLeaf(sessionFile, leafId),
  )
  handleHost(IPC.forkMessage, (host, sessionFile: string, message: MessageRef) =>
    host.forkMessage(sessionFile, message),
  )
  handleHost(IPC.rewindMessage, (host, sessionFile: string, message: MessageRef) =>
    host.rewindMessage(sessionFile, message),
  )
  handleHost(IPC.steer, (host, text: string, sessionFile: string) => host.steer(text, sessionFile))
  handleHost(IPC.removeSteering, (host, index: number, sessionFile: string) =>
    host.removeSteering(index, sessionFile),
  )
  handleHost(IPC.followUp, (host, text: string, sessionFile: string) =>
    host.followUp(text, sessionFile),
  )
  handleHost(IPC.setFollowUpQueue, (host, messages: string[], sessionFile: string) =>
    host.setFollowUpQueue(messages, sessionFile),
  )
  handleHost(IPC.promoteFollowUp, (host, index: number, sessionFile: string) =>
    host.promoteFollowUp(index, sessionFile),
  )
  handleHost(IPC.clearQueue, (host, sessionFile: string) => host.clearQueue(sessionFile))
  handleHost(IPC.clearSteeringQueue, (host, sessionFile: string) =>
    host.clearSteeringQueue(sessionFile),
  )

  ipcMain.handle(IPC.abort, async (event, sessionFile: string) => {
    await from(event.sender)?.host?.abort(sessionFile)
  })
  handleHost(IPC.compact, (host, sessionFile: string) => host.compact(sessionFile))

  handleHost(IPC.setModel, (host, provider: string, modelId: string) =>
    host.setModel(provider, modelId),
  )
  handleHost(IPC.setThinkingLevel, (host, level: ThinkingLevel) => host.setThinkingLevel(level))

  ipcMain.handle(IPC.listSessions, async (event, cwd: string) => {
    if (typeof cwd !== 'string' || !cwd) return []
    const items = await listProjectSessions(cwd)
    const host = from(event.sender)?.host
    if (!host || host.cwd !== cwd) return items
    return withRunning(items, host.runningSessionFiles())
  })

  handleHost(IPC.switchSession, (host, sessionPath: string) => host.switchSession(sessionPath))
  handleHost(IPC.newSession, (host) => host.newSession())
  handleHost(IPC.deleteSession, (host, sessionPath: string) =>
    host.deleteSession(sessionPath, (path) => shell.trashItem(path)),
  )

  ipcMain.handle(IPC.openExternal, async (_event, url: string) => {
    if (!/^https?:\/\//.test(url)) return
    await shell.openExternal(url)
  })

  ipcMain.handle(IPC.openPath, async (_event, path: string) => {
    if (typeof path !== 'string' || !isInPlansDir(path)) return
    const error = await shell.openPath(path)
    if (error) throw new Error(error)
  })

  ipcMain.handle(IPC.readPlan, (_event, path: string) =>
    typeof path === 'string' && isInPlansDir(path) ? readPlan(path) : '',
  )

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

  ipcMain.handle(IPC.imagePreview, (event, path: string) => {
    if (typeof path !== 'string') return null
    const abs = resolveImagePath(path, from(event.sender)?.host?.cwd, homedir())
    const image = abs ? nativeImage.createFromPath(abs) : null
    if (!image || image.isEmpty()) return null
    const { width, height } = image.getSize()
    const src = (height > 480 ? image.resize({ height: 480, quality: 'good' }) : image).toDataURL()
    return { src, width, height }
  })

  ipcMain.handle(IPC.getGeneralSettings, (event) =>
    getGeneralSettings(settingsFolder(event.sender)),
  )

  ipcMain.handle(IPC.patchGeneralSettings, (event, change: GeneralChange) => {
    const { scope, patch } = change ?? {}
    if ((scope !== 'user' && scope !== 'workspace') || !patch || typeof patch !== 'object') {
      throw new Error('Invalid settings patch')
    }
    return patchGeneralSettings(settingsFolder(event.sender), change)
  })

  ipcMain.handle(IPC.getModelSettings, () => getModelSettings())

  ipcMain.handle(IPC.patchModelSettings, (_event, patch: ModelSettingsPatch) => {
    if (!patch || typeof patch !== 'object') throw new Error('Invalid settings patch')
    return patchModelSettings(patch)
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

  ipcMain.handle(IPC.testProvider, (_event, providerId: string) => {
    if (typeof providerId !== 'string') throw new Error('Invalid provider')
    return testProvider(providerId)
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
    app.setName(APP_NAME)
    app.dock?.setIcon(APP_ICON)
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
