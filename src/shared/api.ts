import type {
  ConnectionStatus,
  FileHit,
  ModelSelection,
  SessionEvent,
  SessionListItem,
  SessionSnapshot,
  StartResult,
  ThinkingLevel,
} from './protocol'
import type {
  AppSettings,
  LoginEvent,
  ModelsFileResult,
  SettingsCatalog,
  SettingsPatch,
} from './settings'

export interface PiApi {
  homedir: string
  chooseFolder(): Promise<string | null>
  getRecentProjects(): Promise<string[]>
  removeRecentProject(cwd: string): Promise<void>
  getSnapshot(): Promise<SessionSnapshot | null>
  start(cwd: string): Promise<StartResult>
  stop(): Promise<{ cancelled: boolean }>
  prompt(text: string, sessionFile: string): Promise<void>
  steer(text: string, sessionFile: string): Promise<void>
  removeSteering(index: number, sessionFile: string): Promise<void>
  followUp(text: string, sessionFile: string): Promise<void>
  setFollowUpQueue(messages: string[], sessionFile: string): Promise<void>
  promoteFollowUp(index: number, sessionFile: string): Promise<void>
  clearQueue(sessionFile: string): Promise<{ steering: string[]; followUp: string[] }>
  clearSteeringQueue(sessionFile: string): Promise<void>
  abort(sessionFile: string): Promise<void>
  setModel(provider: string, modelId: string): Promise<ModelSelection>
  setThinkingLevel(level: ThinkingLevel): Promise<ModelSelection>
  listSessions(cwd: string): Promise<SessionListItem[]>
  switchSession(sessionPath: string): Promise<SessionSnapshot>
  newSession(): Promise<SessionSnapshot>
  openExternal(url: string): Promise<void>
  searchFiles(cwd: string, query: string): Promise<FileHit[]>
  statPaths(paths: string[]): Promise<Array<{ path: string; isDirectory: boolean }>>
  saveClipboardImage(data: Uint8Array, mimeType: string): Promise<string>
  getSettings(): Promise<AppSettings>
  patchSettings(patch: SettingsPatch): Promise<AppSettings>
  getModelsFile(): Promise<ModelsFileResult>
  setModelsFile(text: string): Promise<ModelsFileResult>
  getCatalog(): Promise<SettingsCatalog>
  login(providerId: string, type: 'api_key' | 'oauth'): Promise<void>
  loginRespond(id: string, value: string): Promise<void>
  loginCancel(): Promise<void>
  logout(providerId: string): Promise<void>
  onEvent(cb: (event: SessionEvent) => void): () => void
  onStatus(cb: (status: ConnectionStatus, error?: string) => void): () => void
  onCommand(cb: (command: string) => void): () => void
  onLoginEvent(cb: (event: LoginEvent) => void): () => void
}
