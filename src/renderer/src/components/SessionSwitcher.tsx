import { useEffect, useState } from "react";
import { History } from "lucide-react";
import type { SessionListItem } from "@shared/protocol";
import { useChat } from "@/chat/store";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { formatRelativeTime, groupByTime, sessionTitle, TIME_GROUP_LABELS } from "@/lib/format";
import { useSession } from "@/session/store";

export function SessionSwitcher() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SessionListItem[] | null>(null);
  const sessionFile = useSession((state) => state.sessionFile);
  const connection = useSession((state) => state.connection);
  const listSessions = useSession((state) => state.listSessions);
  const switchSession = useSession((state) => state.switchSession);
  const isStreaming = useChat((state) => state.isStreaming);
  const canSwitch = connection === "ready" && !isStreaming;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "r" || !event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      setOpen((current) => !current);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setItems(null);
    void listSessions()
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, listSessions]);

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="app-no-drag text-muted-foreground"
        aria-label="历史会话"
        title="历史会话 (Ctrl+R)"
        onClick={() => setOpen(true)}
      >
        <History />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="历史会话"
        description="搜索并切换当前项目的会话"
      >
        <CommandInput placeholder="搜索会话..." />
        <CommandList>
          {items === null ? (
            <div className="py-6 text-center text-sm text-muted-foreground">加载中...</div>
          ) : items.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">没有历史会话</div>
          ) : (
            <>
              <CommandEmpty>没有匹配的会话</CommandEmpty>
              {groupByTime(items).map(({ group, items: groupItems }) => (
                <CommandGroup key={group} heading={TIME_GROUP_LABELS[group]}>
                  {groupItems.map((item) => {
                    const title = sessionTitle(item);
                    const current = item.path === sessionFile;
                    return (
                      <CommandItem
                        key={item.path}
                        value={`${title} ${item.firstMessage ?? ""} ${item.id}`}
                        disabled={!canSwitch && !current}
                        onSelect={() => {
                          if (current || !canSwitch) {
                            setOpen(false);
                            return;
                          }
                          void switchSession(item.path).then(() => setOpen(false));
                        }}
                      >
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            current ? "bg-foreground" : "bg-muted-foreground/55",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-muted-foreground group-data-selected/command-item:text-foreground">
                          {title}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatRelativeTime(item.modified)}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </>
          )}
        </CommandList>
        <div className="flex shrink-0 items-center gap-3 border-t px-3.5 py-1.5 text-[11px] text-muted-foreground">
          <span>↑↓ 选择</span>
          <span>↵ 打开</span>
        </div>
      </CommandDialog>
    </>
  );
}
