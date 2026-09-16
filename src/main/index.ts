import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from "electron";
import { IPC } from "@shared/ipc";
import type { ConnectionStatus, SessionSnapshot, ThinkingLevel } from "@shared/protocol";
import { readLastCwd, writeLastCwd } from "./last-cwd";
import { RpcClient } from "./rpc-client";

let window: BrowserWindow | null = null;
let client: RpcClient | null = null;

function sendStatus(status: ConnectionStatus, error?: string): void {
  window?.webContents.send(IPC.status, status, error);
}

function sendEvent(event: unknown): void {
  window?.webContents.send(IPC.event, event);
}

async function stopClient(): Promise<void> {
  const current = client;
  client = null;
  if (current) {
    await current.stop();
  }
}

function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? "#09090b" : "#ffffff";
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 960,
    height: 740,
    minWidth: 720,
    minHeight: 560,
    title: "pi",
    show: false,
    backgroundColor: windowBackground(),
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hidden" : "default",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.on("ready-to-show", () => window?.show());
  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.chooseFolder, async () => {
    const result = await dialog.showOpenDialog(window!, {
      title: "选择工作目录",
      properties: ["openDirectory"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(IPC.getLastCwd, () => readLastCwd());

  ipcMain.handle(IPC.start, async (_event, cwd: string): Promise<SessionSnapshot> => {
    await stopClient();
    sendStatus("connecting");
    const next = new RpcClient(cwd);
    next.onEvent((event) => sendEvent(event));
    next.onExit((error) => {
      if (client === next) {
        client = null;
        sendStatus("error", error.message);
      }
    });
    try {
      await next.start();
      const [state, messages, models, thinkingLevels] = await Promise.all([
        next.getState(),
        next.getMessages(),
        next.getAvailableModels(),
        next.getAvailableThinkingLevels(),
      ]);
      client = next;
      writeLastCwd(cwd);
      window?.setTitle(`pi — ${cwd}`);
      sendStatus("ready");
      return { cwd, state, messages, models, thinkingLevels };
    } catch (error) {
      await next.stop();
      const message = error instanceof Error ? error.message : String(error);
      sendStatus("error", message);
      throw error;
    }
  });

  ipcMain.handle(IPC.stop, async () => {
    await stopClient();
    sendStatus("disconnected");
  });

  ipcMain.handle(IPC.prompt, async (_event, text: string) => {
    if (!client) throw new Error("尚未连接 pi");
    await client.prompt(text);
  });

  ipcMain.handle(IPC.abort, async () => {
    if (!client) return;
    await client.abort();
  });

  ipcMain.handle(IPC.setModel, async (_event, provider: string, modelId: string) => {
    if (!client) throw new Error("尚未连接 pi");
    return client.setModel(provider, modelId);
  });

  ipcMain.handle(IPC.setThinkingLevel, async (_event, level: ThinkingLevel) => {
    if (!client) throw new Error("尚未连接 pi");
    return client.setThinkingLevel(level);
  });

  ipcMain.handle(IPC.openExternal, async (_event, url: string) => {
    if (!/^https?:\/\//.test(url)) return;
    await shell.openExternal(url);
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  nativeTheme.on("updated", () => {
    window?.setBackgroundColor(windowBackground());
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void stopClient();
});
