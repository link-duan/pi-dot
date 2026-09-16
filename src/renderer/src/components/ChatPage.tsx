import { useRef } from "react";
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
  const scrollerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      {/* Overlay: keep macOS traffic-light drag space without pushing transcript down */}
      <div
        className="app-drag absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-end px-2 select-none"
        onWheel={(event) => {
          scrollerRef.current?.scrollBy({ top: event.deltaY });
        }}
      >
        <SessionSwitcher />
      </div>

      {error ? (
        <div className="app-no-drag mx-4 mt-9 mb-2 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs text-destructive shadow-sm">
          <p className="min-w-0 flex-1 truncate">{error}</p>
          <div className="flex shrink-0 items-center gap-2.5">
            {cwd && connection === "error" ? (
              <button
                type="button"
                className="font-medium underline underline-offset-2 hover:opacity-80"
                onClick={() => void openCwd(cwd)}
              >
                Reconnect
              </button>
            ) : null}
            <button
              type="button"
              className="font-medium underline underline-offset-2 hover:opacity-80"
              onClick={() => void leave()}
            >
              Change folder
            </button>
          </div>
        </div>
      ) : null}

      <Transcript scrollerRef={scrollerRef} />
      <Composer />
    </div>
  );
}
