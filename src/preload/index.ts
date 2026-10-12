import { homedir } from 'node:os'
import { contextBridge, ipcRenderer } from 'electron'
import type { ImagePreview, PiApi } from '@shared/api'
import { IPC } from '@shared/ipc'
import type {
  AskReply,
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
  getSnapshot: () => ipcRenderer.invoke(IPC.getSnapshot) as Promise<SessionSnapshot | null>,
  start: (cwd: string) => ipcRenderer.invoke(IPC.start, cwd) as Promise<StartResult>,
  stop: () => ipcRenderer.invoke(IPC.stop) as Promise<{ cancelled: boolean }>,
  prompt: (text: string, sessionFile: string, planMode: boolean) =>
    ipcRenderer.invoke(IPC.prompt, text, sessionFile, planMode) as Promise<void>,
  approvePlan: (sessionFile: string, message: string) =>
    ipcRenderer.invoke(IPC.approvePlan, sessionFile, message) as Promise<void>,
  answerQuestion: (sessionFile: string, toolCallId: string, reply: AskReply) =>
    ipcRenderer.invoke(IPC.answerQuestion, sessionFile, toolCallId, reply) as Promise<void>,
  steer: (text: string, sessionFile: string) =>
    ipcRenderer.invoke(IPC.steer, text, sessionFile) as Promise<void>,
  removeSteering: (index: number, sessionFile: string) =>
    ipcRenderer.invoke(IPC.removeSteering, index, sessionFile) as Promise<void>,
  followUp: (text: string, sessionFile: string) =>
    ipcRenderer.invoke(IPC.followUp, text, sessionFile) as Promise<void>,
  setFollowUpQueue: (messages: string[], sessionFile: string) =>
    ipcRenderer.invoke(IPC.setFollowUpQueue, messages, sessionFile) as Promise<void>,
  promoteFollowUp: (index: number, sessionFile: string) =>
    ipcRenderer.invoke(IPC.promoteFollowUp, index, sessionFile) as Promise<void>,
  clearQueue: (sessionFile: string) =>
    ipcRenderer.invoke(IPC.clearQueue, sessionFile) as Promise<{
      steering: string[]
      followUp: string[]
    }>,
  clearSteeringQueue: (sessionFile: string) =>
    ipcRenderer.invoke(IPC.clearSteeringQueue, sessionFile) as Promise<void>,
  abort: (sessionFile: string) => ipcRenderer.invoke(IPC.abort, sessionFile) as Promise<void>,
  compact: (sessionFile: string) => ipcRenderer.invoke(IPC.compact, sessionFile) as Promise<void>,
  setModel: (provider: string, modelId: string) =>
    ipcRenderer.invoke(IPC.setModel, provider, modelId),
  setThinkingLevel: (level: ThinkingLevel) => ipcRenderer.invoke(IPC.setThinkingLevel, level),
  listSessions: (cwd: string) =>
    ipcRenderer.invoke(IPC.listSessions, cwd) as Promise<SessionListItem[]>,
  switchSession: (sessionPath: string) =>
    ipcRenderer.invoke(IPC.switchSession, sessionPath) as Promise<SessionSnapshot>,
  newSession: () => ipcRenderer.invoke(IPC.newSession) as Promise<SessionSnapshot>,
  openExternal: (url: string) => ipcRenderer.invoke(IPC.openExternal, url) as Promise<void>,
  openPath: (path: string) => ipcRenderer.invoke(IPC.openPath, path) as Promise<void>,
  readPlan: (path: string) => ipcRenderer.invoke(IPC.readPlan, path) as Promise<string>,
  searchFiles: (cwd: string, query: string) =>
    ipcRenderer.invoke(IPC.searchFiles, cwd, query) as Promise<FileHit[]>,
  statPaths: (paths: string[]) =>
    ipcRenderer.invoke(IPC.statPaths, paths) as Promise<
      Array<{ path: string; isDirectory: boolean }>
    >,
  saveClipboardImage: (data: Uint8Array, mimeType: string) =>
    ipcRenderer.invoke(IPC.saveClipboardImage, data, mimeType) as Promise<string>,
  imagePreview: (path: string) =>
    ipcRenderer.invoke(IPC.imagePreview, path) as Promise<ImagePreview | null>,
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
