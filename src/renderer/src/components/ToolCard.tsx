import type { ToolLiveState } from "@/chat/state";
import { AlertCircle, Check, ChevronRight, FileCode, Search, Terminal, Wrench } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { asText, compactJson } from "../lib/format";

function getToolIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("command") || lower.includes("bash") || lower.includes("exec") || lower.includes("terminal")) {
    return Terminal;
  }
  if (lower.includes("file") || lower.includes("write") || lower.includes("read") || lower.includes("edit")) {
    return FileCode;
  }
  if (lower.includes("search") || lower.includes("find") || lower.includes("grep")) {
    return Search;
  }
  return Wrench;
}

function getArgSummary(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const record = args as Record<string, unknown>;
  if (typeof record.CommandLine === "string") return record.CommandLine;
  if (typeof record.command === "string") return record.command;
  if (typeof record.TargetFile === "string") return record.TargetFile.split("/").pop() ?? record.TargetFile;
  if (typeof record.AbsolutePath === "string") return record.AbsolutePath.split("/").pop() ?? record.AbsolutePath;
  if (typeof record.path === "string") return record.path.split("/").pop() ?? record.path;
  if (typeof record.Query === "string") return `"${record.Query}"`;
  if (typeof record.query === "string") return `"${record.query}"`;
  return "";
}

export function ToolCard({
  name,
  args,
  live,
}: {
  name: string;
  args: unknown;
  live?: ToolLiveState;
}) {
  const running = live?.status === "running";
  const result = live?.result ?? live?.partialResult;
  const resultText = asText(result);
  const error = Boolean(live?.isError);
  const Icon = getToolIcon(name);
  const argSummary = getArgSummary(live?.args ?? args);

  const [open, setOpen] = useState(running);

  return (
    <div className="my-1.5 overflow-hidden rounded-lg border border-border/70 bg-card/60 transition-colors dark:bg-[#111215]/80">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/40"
      >
        <div className="flex size-5 shrink-0 items-center justify-center rounded bg-muted/70 text-muted-foreground">
          <Icon className="size-3" />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-mono text-[12px] font-medium text-foreground">{name}</span>
          {argSummary ? (
            <span className="truncate font-mono text-[11px] text-muted-foreground">{argSummary}</span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
          {running ? (
            <div className="flex items-center gap-1.5 text-emerald-500">
              <Spinner className="size-3" />
              <span className="text-[11px]">运行中</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-1 text-destructive">
              <AlertCircle className="size-3" />
              <span className="text-[11px]">失败</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground/80">
              <Check className="size-3 text-emerald-500" />
              <span className="text-[11px]">完成</span>
            </div>
          )}

          <ChevronRight
            className={`size-3 text-muted-foreground/60 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          />
        </div>
      </button>

      {open ? (
        <div className="border-t border-border/50 bg-neutral-950/40 p-3 text-xs dark:bg-black/40">
          <div className="mb-1.5 text-[11px] font-mono tracking-wider text-muted-foreground uppercase">
            参数 (Arguments)
          </div>
          <pre className="overflow-x-auto rounded border border-border/40 bg-neutral-950/80 p-2 font-mono text-[11px] text-neutral-300 dark:bg-[#0d0e10]">
            {compactJson(live?.args ?? args)}
          </pre>

          {resultText ? (
            <div className="mt-3">
              <div className="mb-1.5 text-[11px] font-mono tracking-wider text-muted-foreground uppercase">
                输出 (Output)
              </div>
              <pre
                className={`max-h-64 overflow-auto rounded border p-2 font-mono text-[11px] leading-relaxed ${
                  error
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-border/40 bg-neutral-950/80 text-neutral-300 dark:bg-[#0d0e10]"
                }`}
              >
                {resultText}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
