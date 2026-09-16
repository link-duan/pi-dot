import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from "electron";
import { IPC } from "@shared/ipc";
import type { ConnectionStatus, SessionSnapshot, ThinkingLevel } from "@shared/protocol";
import { readLastCwd, writeLastCwd } from "./last-cwd";
import { RpcClient } from "./rpc-client";
import { listProjectSessions } from "./sessions";

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

function installMenu(): void {
  const isMac = process.platform === "darwin";
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: "appMenu" as const }] : []),
      { role: "fileMenu" },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          { role: "reload", accelerator: isMac ? "Cmd+R" : "F5" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      { role: "windowMenu" },
    ]),
  );
}

async function snapshotOf(next: RpcClient): Promise<SessionSnapshot> {
  const [state, messages, models, thinkingLevels] = await Promise.all([
    next.getState(),
    next.getMessages(),
    next.getAvailableModels(),
    next.getAvailableThinkingLevels(),
  ]);
  return { cwd: next.cwd, state, messages, models, thinkingLevels };
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
      const snapshot = await snapshotOf(next);
      client = next;
      writeLastCwd(cwd);
      window?.setTitle(`pi — ${cwd}`);
      sendStatus("ready");
      return snapshot;
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

  ipcMain.handle(IPC.listSessions, async (_event, cwd: string) => {
    if (typeof cwd !== "string" || !cwd) return [];
    return listProjectSessions(cwd);
  });

  ipcMain.handle(IPC.switchSession, async (_event, sessionPath: string) => {
    if (!client) throw new Error("尚未连接 pi");
    const { cancelled } = await client.switchSession(sessionPath);
    if (cancelled) throw new Error("切换会话被取消");
    return snapshotOf(client);
  });

  ipcMain.handle(IPC.openExternal, async (_event, url: string) => {
    if (!/^https?:\/\//.test(url)) return;
    await shell.openExternal(url);
  });
}

app.whenReady().then(() => {
  installMenu();
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
