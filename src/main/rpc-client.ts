import { type ChildProcess, spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import {
  asRpcEvent,
  asThinkingLevel,
  isAgentMessage,
  parseThinkingLevels,
  type AgentMessage,
  type ModelInfo,
  type ModelSelection,
  type RpcEvent,
  type RpcSessionState,
  type ThinkingLevel,
} from "@shared/protocol";
import { consumeJsonl, serializeJsonLine } from "./jsonl";
import { resolvePiPath, spawnEnv } from "./pi-path";

interface Pending {
  resolve: (value: RpcResponse) => void;
  reject: (error: Error) => void;
}

interface RpcResponse {
  id?: string;
  type: "response";
  command: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export class RpcClient {
  private process: ChildProcess | null = null;
  private pending = new Map<string, Pending>();
  private requestId = 0;
  private stderr = "";
  private listeners: Array<(event: RpcEvent) => void> = [];
  private exitListeners: Array<(error: Error) => void> = [];
  private stopReading: (() => void) | null = null;
  private stopping = false;

  constructor(private cwd: string) {}

  onEvent(listener: (event: RpcEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  }

  onExit(listener: (error: Error) => void): () => void {
    this.exitListeners.push(listener);
    return () => {
      this.exitListeners = this.exitListeners.filter((item) => item !== listener);
    };
  }

  getStderr(): string {
    return this.stderr;
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new Error("RPC client already started");
    }

    const env = spawnEnv();
    const piPath = resolvePiPath(env.PATH);
    this.process = spawn(piPath, ["--mode", "rpc"], {
      cwd: this.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const child = this.process;
    child.stderr?.on("data", (chunk: Buffer | string) => {
      this.stderr += chunk.toString();
    });

    const decoder = new StringDecoder("utf8");
    let buffer = "";
    const onData = (chunk: Buffer | string) => {
      buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);
      buffer = consumeJsonl(buffer, (line) => this.handleLine(line));
    };
    const onEnd = () => {
      buffer += decoder.end();
      buffer = consumeJsonl(buffer, (line) => this.handleLine(line));
    };
    child.stdout?.on("data", onData);
    child.stdout?.on("end", onEnd);
    this.stopReading = () => {
      child.stdout?.off("data", onData);
      child.stdout?.off("end", onEnd);
    };

    child.once("exit", (code, signal) => {
      const error = new Error(
        `pi 进程已退出 (code=${code ?? "null"} signal=${signal ?? "null"}). ${this.stderr.trim()}`.trim(),
      );
      for (const pending of this.pending.values()) {
        pending.reject(error);
      }
      this.pending.clear();
      this.process = null;
      if (!this.stopping) {
        for (const listener of this.exitListeners) {
          listener(error);
        }
      }
    });

    try {
      await this.getState();
    } catch (error) {
      await this.stop();
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`无法连接 pi RPC：${detail}${this.stderr ? `\n${this.stderr}` : ""}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.process) return;

    this.stopping = true;
    this.stopReading?.();
    this.stopReading = null;
    const child = this.process;
    this.process = null;

    for (const pending of this.pending.values()) {
      pending.reject(new Error("RPC client stopped"));
    }
    this.pending.clear();

    if (child.exitCode !== null) return;

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 1000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
      child.kill("SIGTERM");
    });
  }

  async prompt(message: string): Promise<void> {
    await this.send({ type: "prompt", message });
  }

  async abort(): Promise<void> {
    await this.send({ type: "abort" });
  }

  async getState(): Promise<RpcSessionState> {
    const data = await this.send<{
      model?: ModelInfo | null;
      isStreaming?: boolean;
      sessionFile?: string;
      sessionId?: string;
      messageCount?: number;
      thinkingLevel?: string;
    }>({ type: "get_state" });
    return {
      model: data?.model ? toModelInfo(data.model) : null,
      thinkingLevel: asThinkingLevel(data?.thinkingLevel) ?? "off",
      isStreaming: Boolean(data?.isStreaming),
      sessionFile: data?.sessionFile,
      sessionId: data?.sessionId,
      messageCount: data?.messageCount ?? 0,
    };
  }

  async getMessages(): Promise<AgentMessage[]> {
    const data = await this.send<{ messages?: unknown[] }>({ type: "get_messages" });
    return (data?.messages ?? []).filter(isAgentMessage);
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    const data = await this.send<{ models: ModelInfo[] }>({ type: "get_available_models" });
    return (data?.models ?? []).map(toModelInfo);
  }

  async getAvailableThinkingLevels(): Promise<ThinkingLevel[]> {
    const data = await this.send<{ levels?: unknown }>({ type: "get_available_thinking_levels" });
    return parseThinkingLevels(data?.levels);
  }

  async setModel(provider: string, modelId: string): Promise<ModelSelection> {
    const model = toModelInfo(await this.send<ModelInfo>({ type: "set_model", provider, modelId }));
    const selection = await this.getModelSelection();
    return { ...selection, model };
  }

  async setThinkingLevel(level: ThinkingLevel): Promise<ModelSelection> {
    await this.send({ type: "set_thinking_level", level });
    return this.getModelSelection();
  }

  private async getModelSelection(): Promise<ModelSelection> {
    const [state, thinkingLevels] = await Promise.all([this.getState(), this.getAvailableThinkingLevels()]);
    return {
      model: state.model ?? { id: "", name: "unknown", provider: "" },
      thinkingLevel: state.thinkingLevel,
      thinkingLevels,
    };
  }

  private handleLine(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== "object") return;
    const record = parsed as { type?: string; id?: string };
    if (record.type === "response" && record.id && this.pending.has(record.id)) {
      const pending = this.pending.get(record.id);
      this.pending.delete(record.id);
      pending?.resolve(parsed as RpcResponse);
      return;
    }

    const event = asRpcEvent(parsed);
    if (!event) return;
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private send<T>(command: Record<string, unknown>): Promise<T> {
    const child = this.process;
    if (!child?.stdin) {
      return Promise.reject(new Error("RPC client not started"));
    }

    const id = `req_${++this.requestId}`;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`等待 ${String(command.type)} 响应超时。${this.stderr}`));
      }, 30000);

      this.pending.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          if (!response.success) {
            reject(new Error(response.error || `${response.command} failed`));
            return;
          }
          resolve(response.data as T);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      child.stdin!.write(serializeJsonLine({ ...command, id }));
    });
  }
}

function toModelInfo(model: Partial<ModelInfo> | null | undefined): ModelInfo {
  return {
    id: String(model?.id ?? ""),
    name: String(model?.name || model?.id || "unknown"),
    provider: String(model?.provider ?? ""),
  };
}
