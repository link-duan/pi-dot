import { memo, useEffect, useRef, useState } from "react";
import { userText, type ToolLiveState } from "@/chat/state";
import { useChat } from "@/chat/store";
import type { AgentMessage, AssistantMessage } from "@shared/protocol";
import { MarkdownBody } from "./MarkdownBody";
import { PiIcon } from "./PiIcon";
import { ToolCard } from "./ToolCard";

export function Transcript() {
  const messages = useChat((state) => state.messages);
  const toolLive = useChat((state) => state.toolLive);
  const isStreaming = useChat((state) => state.isStreaming);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [hasMessages, setHasMessages] = useState(false);

  useEffect(() => {
    setHasMessages(messages.length > 0);
  }, [messages.length]);

  useEffect(() => {
    const node = scroller.current;
    if (!node || !stickToBottom.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, toolLive, isStreaming]);

  return (
    <div
      ref={scroller}
      className="min-h-0 flex-1 overflow-y-auto px-6 py-6"
      onScroll={(event) => {
        const node = event.currentTarget;
        stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
      }}
    >
      {!hasMessages ? (
        <div className="flex h-full flex-col items-center justify-center py-12 text-center select-none">
          <PiIcon className="size-10 text-neutral-400 dark:text-neutral-600" />
          <p className="mt-3 text-xs text-muted-foreground">给 pi 一条指令。</p>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.map((message, index) => (
            <MessageRow
              key={messageKey(message, index)}
              message={message}
              toolLive={toolLive}
              streaming={isStreaming && index === lastAssistantIndex(messages)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function messageKey(message: AgentMessage, fallback: number): string {
  if (message.role === "toolResult") {
    return `toolResult-${message.toolCallId}`;
  }
  if (typeof message.timestamp === "number") {
    return `${message.role}-${message.timestamp}`;
  }
  return `${message.role}-${fallback}`;
}

function lastAssistantIndex(messages: AgentMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "assistant") return i;
  }
  return -1;
}

const MessageRow = memo(function MessageRow({
  message,
  toolLive,
  streaming,
}: {
  message: AgentMessage;
  toolLive: Record<string, ToolLiveState>;
  streaming: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-border/70 bg-card/90 px-4 py-2.5 text-[13.5px] leading-relaxed text-foreground whitespace-pre-wrap shadow-xs select-text dark:bg-muted/60">
          {userText(message)}
        </div>
      </div>
    );
  }

  if (message.role === "assistant") {
    return <AssistantRow message={message} toolLive={toolLive} streaming={streaming} />;
  }

  if (message.role === "toolResult") {
    return null;
  }

  if (message.role === "compactionSummary") {
    return (
      <div className="my-2 flex items-center justify-center gap-2">
        <div className="h-px flex-1 bg-border/50" />
        <span className="rounded-full border border-border/50 bg-muted/50 px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground uppercase">
          上下文已压缩
        </span>
        <div className="h-px flex-1 bg-border/50" />
      </div>
    );
  }

  return null;
});

function AssistantRow({
  message,
  toolLive,
  streaming,
}: {
  message: AssistantMessage;
  toolLive: Record<string, ToolLiveState>;
  streaming: boolean;
}) {
  const lastTextIndex = message.content.reduce((last, block, index) => (block.type === "text" ? index : last), -1);

  return (
    <div className="flex flex-col gap-2.5 select-text">
      {message.content.map((block, contentIndex) => {
        if (block.type === "thinking") {
          const thinking = block.thinking;
          if (!thinking) return null;
          return (
            <details
              key={`thinking-${message.timestamp}-${contentIndex}`}
              className="group/thinking my-1 overflow-hidden rounded-lg border border-border/50 bg-muted/20 text-xs transition-colors hover:border-border/80"
            >
              <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground/60 group-open/thinking:bg-foreground" />
                <span>思考过程</span>
                <span className="ml-auto text-[10px] text-muted-foreground/50">展开/折叠</span>
              </summary>
              <div className="border-t border-border/40 bg-neutral-950/20 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground dark:bg-black/30">
                {thinking}
              </div>
            </details>
          );
        }
        if (block.type === "text") {
          const text = block.text;
          if (!text) return null;
          const key = `text-${message.timestamp}-${contentIndex}`;
          if (streaming && contentIndex === lastTextIndex) {
            return (
              <div key={key} className="whitespace-pre-wrap text-[14px] leading-relaxed">
                {text}
                <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse rounded-xs bg-foreground/70 align-middle" />
              </div>
            );
          }
          return <MarkdownBody key={key} text={text} />;
        }
        if (block.type === "toolCall") {
          return <ToolCard key={block.id} name={block.name} args={block.arguments} live={toolLive[block.id]} />;
        }
        return null;
      })}
      {message.errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {message.errorMessage}
        </div>
      ) : null}
    </div>
  );
}
