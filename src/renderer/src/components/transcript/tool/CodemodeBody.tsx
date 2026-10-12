/* eslint-disable react-doctor/no-array-index-as-key -- SDK calls and output blocks are snapshots with stable positions. */
import { createElement, type RefObject } from 'react'
import { AlertCircle } from 'lucide-react'
import { CodeBlockCopyButton } from 'streamdown'
import { cn } from '@/lib/utils'
import { ScrollFade } from '@/components/ui/scroll-area'
import { HighlightedCode } from '../FileCard'
import { codemodeCallMeta, type CodemodeBodyModel, type CodemodeCall } from './codemode'
import { getToolIcon } from './kind'
import { ToolImage } from './ToolImage'

// One bordered panel, sections split by rules: script, nested calls, output, error.
export function CodemodeBody({
  body,
  scrollRef,
}: {
  body: CodemodeBodyModel
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border bg-muted/30 font-mono text-xs leading-relaxed">
      {body.code ? (
        <section aria-label="Codemode script" className="relative">
          <ScrollFade ref={scrollRef} className="max-h-64" scrollbarClassName="my-0.5">
            <div className="py-2 pr-8 break-all">
              <HighlightedCode source={body.code} language="javascript" />
            </div>
          </ScrollFade>
          <div className="absolute top-1.5 right-2">
            <CodeBlockCopyButton code={body.code} />
          </div>
        </section>
      ) : null}
      {body.calls.length ? (
        <section aria-label="Codemode calls" className="px-3 py-1.5">
          {body.calls.map((call, index) => (
            <CodemodeCallRow key={index} call={call} />
          ))}
        </section>
      ) : null}
      {body.output.length ? (
        <section aria-label="Codemode output">
          <ScrollFade className="max-h-48" scrollbarClassName="my-0.5">
            <div className="space-y-2 px-3 py-2">
              {body.output.map((item, index) =>
                item.type === 'image' ? (
                  <ToolImage key={index} preview={item.image} />
                ) : (
                  <pre key={index} className="break-all whitespace-pre-wrap text-muted-foreground">
                    {item.text}
                  </pre>
                ),
              )}
            </div>
          </ScrollFade>
        </section>
      ) : null}
      {body.error ? (
        <div
          className="flex min-w-0 items-center gap-1.5 px-3 py-1.5 text-destructive/80"
          title={body.error}
        >
          <AlertCircle className="size-3 shrink-0" />
          <span className="min-w-0 truncate">{body.error.split('\n')[0]}</span>
        </div>
      ) : null}
    </div>
  )
}

// One compact line per nested call, like Pi TUI: tool icon, name, raw JSON args, timing and status.
function CodemodeCallRow({ call }: { call: CodemodeCall }) {
  const running = call.status === 'running'
  const meta = codemodeCallMeta(call)
  return (
    <div
      className="flex min-w-0 items-center gap-1.5 font-mono text-xs leading-5"
      title={call.error}
    >
      {createElement(getToolIcon(call.name), {
        className: 'size-3 shrink-0 text-muted-foreground',
      })}
      {/* Children skip their own colors while running so the shimmer gradient shows through. */}
      <span
        className={cn(
          'flex min-w-0 items-baseline gap-1.5',
          running && 'shimmer text-muted-foreground',
        )}
      >
        <span className={cn('shrink-0', !running && 'text-foreground/75')}>{call.name}</span>
        {call.args ? (
          <span className={cn('min-w-0 truncate', !running && 'text-muted-foreground')}>
            {call.args}
          </span>
        ) : null}
        {meta ? (
          <span className={cn('shrink-0 tabular-nums', !running && 'text-muted-foreground/70')}>
            {meta}
          </span>
        ) : null}
      </span>
    </div>
  )
}
