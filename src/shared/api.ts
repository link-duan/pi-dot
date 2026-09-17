import type {
  ConnectionStatus,
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
  start(cwd: string): Promise<SessionSnapshot>
  stop(): Promise<void>
  prompt(text: string): Promise<void>
  abort(): Promise<void>
  setModel(provider: string, modelId: string): Promise<ModelSelection>
  setThinkingLevel(level: ThinkingLevel): Promise<ModelSelection>
  listSessions(cwd: string): Promise<SessionListItem[]>
  switchSession(sessionPath: string): Promise<SessionSnapshot>
  openExternal(url: string): Promise<void>
  onEvent(cb: (event: SessionEvent) => void): () => void
  onStatus(cb: (status: ConnectionStatus, error?: string) => void): () => void
}
