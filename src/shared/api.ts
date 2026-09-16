import type {
  ConnectionStatus,
  ModelSelection,
  RpcEvent,
  SessionSnapshot,
  ThinkingLevel,
} from "./protocol";

export interface PiApi {
  chooseFolder(): Promise<string | null>;
  getLastCwd(): Promise<string | null>;
  start(cwd: string): Promise<SessionSnapshot>;
  stop(): Promise<void>;
  prompt(text: string): Promise<void>;
  abort(): Promise<void>;
  setModel(provider: string, modelId: string): Promise<ModelSelection>;
  setThinkingLevel(level: ThinkingLevel): Promise<ModelSelection>;
  openExternal(url: string): Promise<void>;
  onEvent(cb: (event: RpcEvent) => void): () => void;
  onStatus(cb: (status: ConnectionStatus, error?: string) => void): () => void;
}
