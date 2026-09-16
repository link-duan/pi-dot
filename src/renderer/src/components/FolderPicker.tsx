import { ArrowRight, CornerDownLeft, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { folderName } from "@/lib/path";
import { useSession } from "@/session/store";
import { PiIcon } from "./PiIcon";

export function FolderPicker() {
  const lastCwd = useSession((state) => state.lastCwd);
  const connection = useSession((state) => state.connection);
  const error = useSession((state) => state.error);
  const openFolder = useSession((state) => state.openFolder);
  const openCwd = useSession((state) => state.openCwd);
  const busy = connection === "connecting";

  return (
    <main className="flex h-full flex-col bg-background text-foreground select-none">
      {/* Frameless window drag area - provides breathing room for macOS native traffic lights */}
      <div className="app-drag h-10 w-full shrink-0" />

      <div className="flex flex-1 items-center justify-center px-6 pb-12">
        <div className="w-full max-w-[380px]">
          {/* Brand Mark with Pi */}
          <div className="mb-6 flex size-11 items-center justify-center rounded-xl border border-border/80 bg-gradient-to-b from-card to-muted/40 shadow-xs">
            <PiIcon className="size-5.5 text-foreground" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Open project</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Choose a local folder to connect to pi.
          </p>

          <div className="mt-7 flex flex-col gap-2.5">
            {lastCwd ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void openCwd(lastCwd)}
                className="group relative flex w-full items-center gap-3.5 rounded-xl border border-border/80 bg-card/60 p-3 text-left transition-all hover:border-foreground/20 hover:bg-card hover:shadow-sm disabled:opacity-50 dark:bg-card/40 dark:hover:bg-muted/40"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60 text-muted-foreground group-hover:text-foreground">
                  <Folder className="size-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium text-foreground">
                      {folderName(lastCwd)}
                    </span>
                    <span className="rounded border border-border/50 bg-muted/40 px-1 py-0.2 font-mono text-[9px] text-muted-foreground uppercase">
                      Recent
                    </span>
                  </div>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground/80">
                    {lastCwd}
                  </span>
                </div>

                <div className="flex shrink-0 items-center pl-1 text-muted-foreground/60 group-hover:text-foreground">
                  {busy ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <div className="flex items-center gap-1">
                      <CornerDownLeft className="size-3" />
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  )}
                </div>
              </button>
            ) : null}

            <Button
              disabled={busy}
              onClick={() => void openFolder()}
              variant={lastCwd ? "outline" : "default"}
              className="h-9.5 w-full rounded-xl text-xs font-medium shadow-xs"
            >
              <FolderOpen className="size-3.5" />
              <span>{lastCwd ? "Choose another folder" : "Open folder"}</span>
            </Button>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <p className="whitespace-pre-wrap">{error}</p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
