import { contextBridge, ipcRenderer } from "electron";
import type { PiApi } from "@shared/api";
import { IPC } from "@shared/ipc";
import type { ConnectionStatus, RpcEvent, SessionSnapshot, ThinkingLevel } from "@shared/protocol";

const api: PiApi = {
  chooseFolder: () => ipcRenderer.invoke(IPC.chooseFolder) as Promise<string | null>,
  getLastCwd: () => ipcRenderer.invoke(IPC.getLastCwd) as Promise<string | null>,
  start: (cwd: string) => ipcRenderer.invoke(IPC.start, cwd) as Promise<SessionSnapshot>,
  stop: () => ipcRenderer.invoke(IPC.stop) as Promise<void>,
  prompt: (text: string) => ipcRenderer.invoke(IPC.prompt, text) as Promise<void>,
  abort: () => ipcRenderer.invoke(IPC.abort) as Promise<void>,
  setModel: (provider: string, modelId: string) =>
    ipcRenderer.invoke(IPC.setModel, provider, modelId),
  setThinkingLevel: (level: ThinkingLevel) => ipcRenderer.invoke(IPC.setThinkingLevel, level),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.openExternal, url) as Promise<void>,
  onEvent: (cb: (event: RpcEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: RpcEvent) => cb(payload);
    ipcRenderer.on(IPC.event, listener);
    return () => {
      ipcRenderer.removeListener(IPC.event, listener);
    };
  },
  onStatus: (cb: (status: ConnectionStatus, error?: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: ConnectionStatus, error?: string) => {
      cb(status, error);
    };
    ipcRenderer.on(IPC.status, listener);
    return () => {
      ipcRenderer.removeListener(IPC.status, listener);
    };
  },
};

contextBridge.exposeInMainWorld("pi", api);
