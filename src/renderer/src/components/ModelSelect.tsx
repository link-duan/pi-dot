import { useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import {
  isThinkingLevel,
  THINKING_LEVEL_LABELS,
  type ModelInfo,
  type ThinkingLevel,
} from "@shared/protocol";
import { useChat } from "@/chat/store";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSession } from "@/session/store";

function modelKey(model: ModelInfo): string {
  return `${model.provider}::${model.id}`;
}

export function ModelSelect() {
  const models = useSession((state) => state.models);
  const model = useSession((state) => state.model);
  const thinkingLevel = useSession((state) => state.thinkingLevel);
  const thinkingLevels = useSession((state) => state.thinkingLevels);
  const connection = useSession((state) => state.connection);
  const setModel = useSession((state) => state.setModel);
  const setThinkingLevel = useSession((state) => state.setThinkingLevel);
  const isStreaming = useChat((state) => state.isStreaming);
  const disabled = isStreaming || connection !== "ready" || models.length === 0;

  const [query, setQuery] = useState("");

  const filteredModels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return models;
    return models.filter((item) =>
      `${item.provider} ${item.name} ${item.id}`.toLowerCase().includes(needle),
    );
  }, [models, query]);

  return (
    <DropdownMenu
      disabled={disabled}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
    >
      <DropdownMenuTrigger
        aria-label="Select model and thinking level"
        disabled={disabled}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-7 max-w-64 gap-2 px-2 text-xs text-muted-foreground transition-colors duration-150",
          "disabled:opacity-40",
        )}
      >
        <span className="min-w-0 truncate text-muted-foreground capitalize">
          {model?.name ?? "Select model"}
        </span>
        {model ? (
          <span className="shrink-0 text-muted-foreground">
            {THINKING_LEVEL_LABELS[thinkingLevel]}
          </span>
        ) : null}
        <ChevronDownIcon className="pointer-events-none size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-48" sideOffset={6}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="shrink-0">Thinking</span>
            <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">
              {THINKING_LEVEL_LABELS[thinkingLevel]}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-36">
            <DropdownMenuRadioGroup
              value={thinkingLevel}
              onValueChange={(value) => {
                if (isThinkingLevel(value)) void setThinkingLevel(value);
              }}
            >
              {thinkingLevels.map((level: ThinkingLevel) => (
                <DropdownMenuRadioItem key={level} value={level}>
                  {THINKING_LEVEL_LABELS[level]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuSub
          onOpenChange={(open) => {
            if (!open) setQuery("");
          }}
        >
          <DropdownMenuSubTrigger>
            <span className="shrink-0">Model</span>
            <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">
              {model?.name ?? "None"}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72 overflow-hidden overflow-y-hidden p-0">
            <div className="p-1 pb-0">
              <Input
                value={query}
                aria-label="Search models"
                placeholder="Search models..."
                className="h-8 text-sm"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Enter")
                    return;
                  event.stopPropagation();
                }}
              />
            </div>
            <div className="max-h-[min(calc(20rem-2.5rem),calc(var(--available-height)-2.5rem))] scroll-fade overflow-y-auto overscroll-contain p-1">
              {filteredModels.length === 0 ? (
                <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                  No matching models
                </div>
              ) : (
                <DropdownMenuRadioGroup
                  value={model ? modelKey(model) : ""}
                  onValueChange={(value) => {
                    const next = models.find((item) => modelKey(item) === value);
                    if (next) void setModel(next.provider, next.id);
                  }}
                >
                  {filteredModels.map((item) => (
                    <DropdownMenuRadioItem
                      key={modelKey(item)}
                      value={modelKey(item)}
                      className="py-1.5"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm">{item.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {item.provider}
                        </span>
                      </div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
