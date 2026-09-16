import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CodeBlock({
  language,
  value,
}: {
  language: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-lg border border-border/70 bg-neutral-950 dark:border-white/10 dark:bg-[#0c0d0e]">
      <div className="flex h-8 items-center justify-between border-b border-border/40 bg-neutral-900/60 px-3 text-[11px] font-mono text-neutral-400 dark:border-white/5 dark:bg-neutral-900/40">
        <span>{language || "text"}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-neutral-400 transition-colors hover:bg-white/10 hover:text-neutral-200"
          aria-label="复制代码"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-400" />
              <span className="text-emerald-400">已复制</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[12px] leading-relaxed text-neutral-200">
        <code>{value}</code>
      </pre>
    </div>
  );
}

const components: Components = {
  a: ({ href, children }) => (
    <button
      type="button"
      className="inline-flex cursor-pointer items-center underline underline-offset-3 hover:text-foreground"
      onClick={() => href && void window.pi.openExternal(href)}
    >
      {children}
    </button>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");
    const isBlock = Boolean(match) || codeString.includes("\n");

    if (isBlock) {
      return <CodeBlock language={match ? match[1] : ""} value={codeString} />;
    }

    return (
      <code
        className="rounded border border-border/50 bg-muted/60 px-1.5 py-0.5 font-mono text-[12px] text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  },
};

export function MarkdownBody({ text }: { text: string }) {
  return (
    <div className="markdown text-[14px] leading-relaxed">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </Markdown>
    </div>
  );
}
