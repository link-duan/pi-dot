import { useSession } from "@/session/store";
import { Composer } from "./Composer";
import { SessionSwitcher } from "./SessionSwitcher";
import { Transcript } from "./Transcript";

export function ChatPage() {
  const cwd = useSession((state) => state.cwd);
  const connection = useSession((state) => state.connection);
  const error = useSession((state) => state.error);
  const openCwd = useSession((state) => state.openCwd);
  const leave = useSession((state) => state.leave);

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Frameless window drag area - provides breathing room for macOS native traffic lights without any visual header bar */}
      <div className="app-drag flex h-9 w-full shrink-0 items-center justify-end px-2 select-none">
        <SessionSwitcher />
      </div>

      {error ? (
        <div className="app-no-drag mx-4 mb-2 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs text-destructive shadow-sm">
          <p className="min-w-0 flex-1 truncate">{error}</p>
          <div className="flex shrink-0 items-center gap-2.5">
            {cwd && connection === "error" ? (
              <button
                type="button"
                className="font-medium underline underline-offset-2 hover:opacity-80"
                onClick={() => void openCwd(cwd)}
              >
                重连
              </button>
            ) : null}
            <button
              type="button"
              className="font-medium underline underline-offset-2 hover:opacity-80"
              onClick={() => void leave()}
            >
              更换目录
            </button>
          </div>
        </div>
      ) : null}

      <Transcript />
      <Composer />
    </div>
  );
}
