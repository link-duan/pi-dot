import { homedir } from 'node:os'
import { contextBridge, ipcRenderer } from 'electron'
import type { PiApi } from '@shared/api'
import { IPC } from '@shared/ipc'
import type {
  ConnectionStatus,
  FileHit,
  SessionEvent,
  SessionListItem,
  SessionSnapshot,
  StartResult,
  ThinkingLevel,
} from '@shared/protocol'
import type {
  AppSettings,
  LoginEvent,
  ModelsFileResult,
  SettingsCatalog,
  SettingsPatch,
} from '@shared/settings'

const api: PiApi = {
  homedir: homedir(),
  chooseFolder: () => ipcRenderer.invoke(IPC.chooseFolder) as Promise<string | null>,
  getRecentProjects: () => ipcRenderer.invoke(IPC.getRecentProjects) as Promise<string[]>,
  removeRecentProject: (cwd: string) =>
    ipcRenderer.invoke(IPC.removeRecentProject, cwd) as Promise<void>,
  getLastCwd: () => ipcRenderer.invoke(IPC.getLastCwd) as Promise<string | null>,
  getSnapshot: () => ipcRenderer.invoke(IPC.getSnapshot) as Promise<SessionSnapshot | null>,
  start: (cwd: string) => ipcRenderer.invoke(IPC.start, cwd) as Promise<StartResult>,
  stop: () => ipcRenderer.invoke(IPC.stop) as Promise<{ cancelled: boolean }>,
  prompt: (text: string) => ipcRenderer.invoke(IPC.prompt, text) as Promise<void>,
  abort: () => ipcRenderer.invoke(IPC.abort) as Promise<void>,
  setModel: (provider: string, modelId: string) =>
    ipcRenderer.invoke(IPC.setModel, provider, modelId),
  setThinkingLevel: (level: ThinkingLevel) => ipcRenderer.invoke(IPC.setThinkingLevel, level),
  listSessions: (cwd: string) =>
    ipcRenderer.invoke(IPC.listSessions, cwd) as Promise<SessionListItem[]>,
  switchSession: (sessionPath: string) =>
    ipcRenderer.invoke(IPC.switchSession, sessionPath) as Promise<SessionSnapshot>,
  newSession: () => ipcRenderer.invoke(IPC.newSession) as Promise<SessionSnapshot>,
  openExternal: (url: string) => ipcRenderer.invoke(IPC.openExternal, url) as Promise<void>,
  searchFiles: (cwd: string, query: string) =>
    ipcRenderer.invoke(IPC.searchFiles, cwd, query) as Promise<FileHit[]>,
  statPaths: (paths: string[]) =>
    ipcRenderer.invoke(IPC.statPaths, paths) as Promise<
      Array<{ path: string; isDirectory: boolean }>
    >,
  saveClipboardImage: (data: Uint8Array, mimeType: string) =>
    ipcRenderer.invoke(IPC.saveClipboardImage, data, mimeType) as Promise<string>,
  getSettings: () => ipcRenderer.invoke(IPC.getSettings) as Promise<AppSettings>,
  patchSettings: (patch: SettingsPatch) =>
    ipcRenderer.invoke(IPC.patchSettings, patch) as Promise<AppSettings>,
  getModelsFile: () => ipcRenderer.invoke(IPC.getModelsFile) as Promise<ModelsFileResult>,
  setModelsFile: (text: string) =>
    ipcRenderer.invoke(IPC.setModelsFile, text) as Promise<ModelsFileResult>,
  getCatalog: () => ipcRenderer.invoke(IPC.getCatalog) as Promise<SettingsCatalog>,
  login: (providerId: string, type: 'api_key' | 'oauth') =>
    ipcRenderer.invoke(IPC.login, providerId, type) as Promise<void>,
  loginRespond: (id: string, value: string) =>
    ipcRenderer.invoke(IPC.loginRespond, id, value) as Promise<void>,
  loginCancel: () => ipcRenderer.invoke(IPC.loginCancel) as Promise<void>,
  logout: (providerId: string) => ipcRenderer.invoke(IPC.logout, providerId) as Promise<void>,
  onEvent: (cb: (event: SessionEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: SessionEvent) => cb(payload)
    ipcRenderer.on(IPC.event, listener)
    return () => {
      ipcRenderer.removeListener(IPC.event, listener)
    }
  },
  onStatus: (cb: (status: ConnectionStatus, error?: string) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: ConnectionStatus,
      error?: string,
    ) => {
      cb(status, error)
    }
    ipcRenderer.on(IPC.status, listener)
    return () => {
      ipcRenderer.removeListener(IPC.status, listener)
    }
  },
  onCommand: (cb: (command: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: string) => cb(command)
    ipcRenderer.on(IPC.command, listener)
    return () => {
      ipcRenderer.removeListener(IPC.command, listener)
    }
  },
  onLoginEvent: (cb: (event: LoginEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: LoginEvent) => cb(payload)
    ipcRenderer.on(IPC.loginEvent, listener)
    return () => {
      ipcRenderer.removeListener(IPC.loginEvent, listener)
    }
  },
}

contextBridge.exposeInMainWorld('pi', api)
