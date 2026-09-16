import { ArrowUp, Folder, Square } from "lucide-react";
import { useRef, useState } from "react";
import { useChat } from "@/chat/store";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { folderName } from "@/lib/path";
import { useSession } from "@/session/store";
import { ModelSelect } from "./ModelSelect";

export function Composer() {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cwd = useSession((state) => state.cwd);
  const connection = useSession((state) => state.connection);
  const send = useSession((state) => state.send);
  const abort = useSession((state) => state.abort);
  const openFolder = useSession((state) => state.openFolder);
  const isStreaming = useChat((state) => state.isStreaming);

  const canSend = connection === "ready" && text.trim().length > 0 && !isStreaming;

  function submit() {
    const next = text.trim();
    if (!next || isStreaming || connection !== "ready") return;
    setText("");
    void send(next);
  }

  return (
    <form
      className="shrink-0 px-4 pt-1 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-border/80 bg-card/90 p-2 shadow-xl shadow-black/5 backdrop-blur-md transition-all duration-200 focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/20 dark:bg-[#121316]/95 dark:shadow-black/50">
        <label className="sr-only" htmlFor="prompt-input">
          Prompt
        </label>
        <textarea
          ref={textareaRef}
          id="prompt-input"
          value={text}
          rows={1}
          placeholder="Message... (Enter to send, Shift+Enter for newline)"
          className="field-sizing-content min-h-[44px] max-h-48 w-full resize-none border-0 bg-transparent px-2.5 py-1.5 text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />

        <div className="mt-1.5 flex items-center justify-between border-t border-border/40 pt-2 pr-1 pl-1 text-xs">
          {/* Left: Working directory & Streaming indicator */}
          <div className="flex items-center gap-2">
            {cwd ? (
              <button
                type="button"
                onClick={() => void openFolder()}
                className="flex max-w-56 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={`Current folder: ${cwd} (click to change)`}
              >
                <Folder className="size-3 shrink-0" />
                <span className="truncate">{folderName(cwd)}</span>
              </button>
            ) : null}

            {isStreaming ? (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Spinner className="size-3" />
                <span>Generating</span>
              </div>
            ) : null}
          </div>

          {/* Right: Model Select & Submit */}
          <div className="flex items-center gap-1.5">
            <ModelSelect />

            {isStreaming ? (
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                className="rounded-full shadow-xs"
                aria-label="Stop"
                onClick={() => void abort()}
              >
                <Square className="size-3 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-sm"
                className="rounded-full shadow-xs transition-opacity"
                disabled={!canSend}
                aria-label="Send"
              >
                <ArrowUp className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
