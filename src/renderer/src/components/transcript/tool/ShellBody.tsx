import { useMemo, type RefObject } from 'react'
import { ansiStyleToCss, parseAnsi } from '@/lib/ansi'
import { tokenizeShell, type ShellTokenKind } from '@/lib/shell-highlight'
import { cn } from '@/lib/utils'
import { ScrollFade } from '@/components/ui/scroll-area'

const TOKEN_CLASS: Record<ShellTokenKind, string> = {
  command: 'text-amber-600 dark:text-amber-400',
  string: 'text-emerald-600 dark:text-emerald-400',
  flag: 'text-muted-foreground',
  operator: 'text-muted-foreground',
  comment: 'text-muted-foreground',
  text: 'text-foreground',
}

export function ShellBody({
  command,
  resultText,
  error,
  scrollRef,
}: {
  command: string
  resultText: string
  error: boolean
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const spans = useMemo(() => parseAnsi(resultText), [resultText])
  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border bg-muted/30 font-mono text-xs leading-relaxed">
      <ScrollFade ref={scrollRef} className="max-h-64" scrollbarClassName="my-0.5">
        {command ? (
          <div className="flex gap-2 px-3 py-2">
            <span className="shrink-0 text-muted-foreground select-none">$</span>
            <span className="min-w-0 whitespace-pre-wrap">
              {tokenizeShell(command).map((token, index) => (
                <span key={index} className={TOKEN_CLASS[token.kind]}>
                  {token.value}
                </span>
              ))}
            </span>
          </div>
        ) : null}
        {resultText ? (
          <pre
            className={cn(
              'px-3 py-2 whitespace-pre-wrap',
              command && 'border-t border-border',
              error ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {spans.map((span, index) => (
              <span key={index} style={ansiStyleToCss(span.style)}>
                {span.text}
              </span>
            ))}
          </pre>
        ) : null}
      </ScrollFade>
    </div>
  )
}
