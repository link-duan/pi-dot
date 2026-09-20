import type { RefObject } from 'react'
import { cn } from '@/lib/utils'
import { ScrollFade } from '@/components/ui/scroll-area'

export function ToolDetails({
  argsText,
  resultText,
  error,
  scrollRef,
}: {
  argsText: string
  resultText: string
  error: boolean
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      {argsText ? (
        <ScrollFade className="max-h-64">
          <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {argsText}
          </pre>
        </ScrollFade>
      ) : null}
      {resultText ? (
        <div className={argsText ? 'mt-2' : undefined}>
          <ScrollFade ref={scrollRef} className="max-h-64">
            <pre
              className={cn(
                'font-mono text-xs leading-relaxed whitespace-pre-wrap',
                error ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {resultText}
            </pre>
          </ScrollFade>
        </div>
      ) : null}
    </>
  )
}
