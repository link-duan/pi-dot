import { createChatState, hydrateMessages } from "@/chat/state";
import { useChat } from "@/chat/store";
import type {
  ConnectionStatus,
  ModelInfo,
  ModelSelection,
  SessionListItem,
  SessionSnapshot,
  ThinkingLevel,
} from "@shared/protocol";
import { create } from "zustand";

interface SessionStore {
  lastCwd: string | null;
  cwd: string | null;
  sessionId: string | null;
  sessionFile: string | null;
  connection: ConnectionStatus;
  error: string | null;
  models: ModelInfo[];
  model: ModelInfo | null;
  thinkingLevel: ThinkingLevel;
  thinkingLevels: ThinkingLevel[];
  init: () => Promise<void>;
  openFolder: () => Promise<void>;
  openCwd: (cwd: string) => Promise<void>;
  leave: () => Promise<void>;
  send: (text: string) => Promise<void>;
  abort: () => Promise<void>;
  setModel: (provider: string, modelId: string) => Promise<void>;
  setThinkingLevel: (level: ThinkingLevel) => Promise<void>;
  listSessions: () => Promise<SessionListItem[]>;
  switchSession: (sessionPath: string) => Promise<void>;
}

function selectionPatch(selection: ModelSelection) {
  return {
    model: selection.model,
    thinkingLevel: selection.thinkingLevel,
    thinkingLevels: selection.thinkingLevels,
  };
}

function snapshotPatch(snapshot: SessionSnapshot) {
  return {
    cwd: snapshot.cwd,
    lastCwd: snapshot.cwd,
    sessionId: snapshot.state.sessionId ?? null,
    sessionFile: snapshot.state.sessionFile ?? null,
    connection: "ready" as const,
    error: snapshot.models.length === 0 ? "No models available. Run pi in a terminal and complete /login first." : null,
    models: snapshot.models,
    model: snapshot.state.model ?? snapshot.models[0] ?? null,
    thinkingLevel: snapshot.state.thinkingLevel,
    thinkingLevels: snapshot.thinkingLevels,
  };
}

export const useSession = create<SessionStore>((set, get) => ({
  lastCwd: null,
  cwd: null,
  sessionId: null,
  sessionFile: null,
  connection: "disconnected",
  error: null,
  models: [],
  model: null,
  thinkingLevel: "off",
  thinkingLevels: [],

  init: async () => {
    const lastCwd = await window.pi.getLastCwd();
    set({ lastCwd });
  },

  openFolder: async () => {
    const cwd = await window.pi.chooseFolder();
    if (cwd) await get().openCwd(cwd);
  },

  openCwd: async (cwd: string) => {
    set({ connection: "connecting", error: null, cwd });
    useChat.setState(createChatState());
    try {
      const snapshot = await window.pi.start(cwd);
      set(snapshotPatch(snapshot));
      useChat.setState(hydrateMessages(snapshot.messages));
    } catch (error) {
      set({
        connection: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  leave: async () => {
    try {
      await window.pi.stop();
    } catch {
      // drop the local session even if the process is already gone
    }
    set({
      cwd: null,
      sessionId: null,
      sessionFile: null,
      connection: "disconnected",
      error: null,
      models: [],
      model: null,
      thinkingLevel: "off",
      thinkingLevels: [],
    });
    useChat.setState(createChatState());
  },

  send: async (text: string) => {
    set({ error: null });
    useChat.setState({ isStreaming: true });
    try {
      await window.pi.prompt(text);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      useChat.setState({ isStreaming: false });
    }
  },

  abort: async () => {
    try {
      await window.pi.abort();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  setModel: async (provider: string, modelId: string) => {
    try {
      const selection = await window.pi.setModel(provider, modelId);
      set({ ...selectionPatch(selection), error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  setThinkingLevel: async (level: ThinkingLevel) => {
    try {
      const selection = await window.pi.setThinkingLevel(level);
      set({ ...selectionPatch(selection), error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  listSessions: async () => {
    const cwd = get().cwd;
    if (!cwd) return [];
    return window.pi.listSessions(cwd);
  },

  switchSession: async (sessionPath: string) => {
    if (get().sessionFile === sessionPath) return;
    try {
      const snapshot = await window.pi.switchSession(sessionPath);
      set(snapshotPatch(snapshot));
      useChat.setState(hydrateMessages(snapshot.messages));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
}));
