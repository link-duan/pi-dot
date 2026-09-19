import type {
  ConnectionStatus,
  FileHit,
  ModelSelection,
  SessionEvent,
  SessionListItem,
  SessionSnapshot,
  ThinkingLevel,
} from './protocol'

export interface PiApi {
  homedir: string
  chooseFolder(): Promise<string | null>
  getLastCwd(): Promise<string | null>
  getSnapshot(): Promise<SessionSnapshot | null>
  start(cwd: string): Promise<SessionSnapshot>
  stop(): Promise<void>
  prompt(text: string): Promise<void>
  abort(): Promise<void>
  setModel(provider: string, modelId: string): Promise<ModelSelection>
  setThinkingLevel(level: ThinkingLevel): Promise<ModelSelection>
  listSessions(cwd: string): Promise<SessionListItem[]>
  switchSession(sessionPath: string): Promise<SessionSnapshot>
  newSession(): Promise<SessionSnapshot>
  openExternal(url: string): Promise<void>
  searchFiles(cwd: string, query: string): Promise<FileHit[]>
  statPaths(paths: string[]): Promise<Array<{ path: string; isDirectory: boolean }>>
  saveClipboardImage(data: Uint8Array, mimeType: string): Promise<string>
  onEvent(cb: (event: SessionEvent) => void): () => void
  onStatus(cb: (status: ConnectionStatus, error?: string) => void): () => void
}
