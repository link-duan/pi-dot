import type {
  AskReply,
  ConnectionStatus,
  FileHit,
  MessageRef,
  ModelSelection,
  SessionEvent,
  SessionListItem,
  SessionSnapshot,
  StartResult,
  ThinkingLevel,
  UiResponse,
} from './protocol'
import type {
  GeneralSettingsState,
  LoginEvent,
  ModelSettings,
  ModelSettingsPatch,
  ModelsFileResult,
  ProviderTestResult,
  SettingsCatalog,
  GeneralChange,
} from './settings'

export interface ImagePreview {
  src: string
  width: number
  height: number
}

export interface PiApi {
  homedir: string
  chooseFolder(): Promise<string | null>
  getRecentProjects(): Promise<string[]>
  removeRecentProject(cwd: string): Promise<void>
  getSnapshot(): Promise<SessionSnapshot | null>
  start(cwd: string): Promise<StartResult>
  stop(): Promise<{ cancelled: boolean }>
  prompt(text: string, sessionFile: string, planMode: boolean): Promise<void>
  approvePlan(sessionFile: string, message: string): Promise<void>
  answerQuestion(sessionFile: string, toolCallId: string, reply: AskReply): Promise<void>
  respondUi(sessionFile: string, id: string, response: UiResponse): Promise<void>
  /** Asks again whether to trust the folder; `started` when it was rebound. */
  retrust(): Promise<StartResult>
  /** Rewinds to before the user message sent at `timestamp`, for its edit to be sent. */
  editMessage(sessionFile: string, timestamp: number): Promise<SessionSnapshot>
  renameSession(sessionFile: string, name: string): Promise<void>
  /** Whether the user message sent at `timestamp` was sent in plan mode. */
  messagePlanMode(sessionFile: string, timestamp: number): Promise<boolean>
  /** Returns to `leafId`, undoing a rewind. */
  restoreLeaf(sessionFile: string, leafId: string): Promise<SessionSnapshot>
  /** Starts a new session before a user message, or through a reply. */
  forkMessage(
    sessionFile: string,
    message: MessageRef,
  ): Promise<{ snapshot: SessionSnapshot; text: string }>
  /** Rewinds to a user message, or through a reply's turn; `leafId` undoes it. */
  rewindMessage(
    sessionFile: string,
    message: MessageRef,
  ): Promise<{ snapshot: SessionSnapshot; leafId: string | null }>
  steer(text: string, sessionFile: string): Promise<void>
  removeSteering(index: number, sessionFile: string): Promise<void>
  followUp(text: string, sessionFile: string): Promise<void>
  setFollowUpQueue(messages: string[], sessionFile: string): Promise<void>
  promoteFollowUp(index: number, sessionFile: string): Promise<void>
  clearQueue(sessionFile: string): Promise<{ steering: string[]; followUp: string[] }>
  clearSteeringQueue(sessionFile: string): Promise<void>
  abort(sessionFile: string): Promise<void>
  compact(sessionFile: string): Promise<void>
  setModel(provider: string, modelId: string): Promise<ModelSelection>
  setThinkingLevel(level: ThinkingLevel): Promise<ModelSelection>
  listSessions(cwd: string): Promise<SessionListItem[]>
  switchSession(sessionPath: string): Promise<SessionSnapshot>
  newSession(): Promise<SessionSnapshot>
  deleteSession(sessionPath: string): Promise<SessionSnapshot>
  openExternal(url: string): Promise<void>
  openPath(path: string): Promise<void>
  readPlan(path: string): Promise<string>
  searchFiles(cwd: string, query: string): Promise<FileHit[]>
  statPaths(paths: string[]): Promise<Array<{ path: string; isDirectory: boolean }>>
  saveClipboardImage(data: Uint8Array, mimeType: string): Promise<string>
  /** Downscaled data URL and original size of an image file-chip path, or null when unreadable. */
  imagePreview(path: string): Promise<ImagePreview | null>
  getGeneralSettings(): Promise<GeneralSettingsState>
  patchGeneralSettings(change: GeneralChange): Promise<GeneralSettingsState>
  getModelSettings(): Promise<ModelSettings>
  patchModelSettings(patch: ModelSettingsPatch): Promise<ModelSettings>
  getModelsFile(): Promise<ModelsFileResult>
  setModelsFile(text: string): Promise<ModelsFileResult>
  getCatalog(): Promise<SettingsCatalog>
  login(providerId: string, type: 'api_key' | 'oauth'): Promise<void>
  loginRespond(id: string, value: string): Promise<void>
  loginCancel(): Promise<void>
  logout(providerId: string): Promise<void>
  testProvider(providerId: string): Promise<ProviderTestResult>
  onEvent(cb: (event: SessionEvent) => void): () => void
  onStatus(cb: (status: ConnectionStatus, error?: string) => void): () => void
  onCommand(cb: (command: string, arg?: string) => void): () => void
  onLoginEvent(cb: (event: LoginEvent) => void): () => void
}
