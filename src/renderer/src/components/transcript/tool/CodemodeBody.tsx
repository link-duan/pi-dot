/* eslint-disable react-doctor/no-array-index-as-key -- SDK calls and output blocks are snapshots with stable positions. */
import { createElement, useState, type RefObject } from 'react'
import { AlertCircle, ChevronUp, CodeXml } from 'lucide-react'
import { CodeBlockCopyButton } from 'streamdown'
import { cn } from '@/lib/utils'
import { useSession } from '@/session/store'
import { ScrollFade } from '@/components/ui/scroll-area'
import { HighlightedCode } from '@/components/transcript/HighlightedCode'
import {
  codemodeCallMeta,
  codemodeCallSummary,
  type CodemodeBodyModel,
  type CodemodeCall,
} from './codemode'
import { getToolIcon } from './kind'
import { ToolImages } from './ToolImage'

// The copy button's global style zeroes its padding; `!` restores it so both actions get the same hover box.
const SCRIPT_ACTION =
  'rounded p-1! text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none'

// Opaque, so the hover actions can share it and cover the code beneath them.
const PANEL_BG = 'bg-[color-mix(in_oklch,var(--muted)_30%,var(--background))]'

// One bordered panel, sections split by rules: script, nested calls, output, error.
// The script folds to one line once calls or output arrive; those are what the reader came for.
export function CodemodeBody({
  body,
  scrollRef,
}: {
  body: CodemodeBodyModel
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const cwd = useSession((state) => state.cwd)
  const [scriptOpen, setScriptOpen] = useState<boolean | null>(null)
  const settled = Boolean(body.calls.length || body.output.length || body.error)
  const open = scriptOpen ?? !settled
  return (
    <div
      className={cn(
        'mt-2 divide-y divide-border overflow-hidden rounded-md border border-border font-mono text-xs leading-relaxed',
        PANEL_BG,
      )}
    >
      {body.code ? (
        <section aria-label="Codemode script" className="group/script relative">
          {open ? (
            <>
              <ScrollFade ref={scrollRef} className="max-h-64" scrollbarClassName="my-0.5">
                <div className="py-2 pr-3 break-all">
                  <HighlightedCode source={body.code} language="javascript" />
                </div>
              </ScrollFade>
              {/* Actions float over the code on hover, so the code keeps the full width. */}
              <div
                className={cn(
                  'absolute top-1.5 right-2 flex items-center gap-0.5 rounded-md border border-border p-0.5 opacity-0 transition-opacity group-hover/script:opacity-100 focus-within:opacity-100',
                  PANEL_BG,
                )}
              >
                {settled ? (
                  <button
                    type="button"
                    aria-label="Collapse script"
                    aria-expanded
                    className={SCRIPT_ACTION}
                    onClick={() => setScriptOpen(false)}
                  >
                    <ChevronUp className="size-3" />
                  </button>
                ) : null}
                <CodeBlockCopyButton code={body.code} className={SCRIPT_ACTION} />
              </div>
            </>
          ) : (
            <ScriptFold code={body.code} onOpen={() => setScriptOpen(true)} />
          )}
        </section>
      ) : null}
      {body.calls.length ? (
        <section aria-label="Codemode calls" className="px-3 py-1.5">
          {body.calls.map((call, index) => (
            <CodemodeCallRow
              key={index}
              call={call}
              summary={codemodeCallSummary(call, cwd, window.pi.homedir)}
            />
          ))}
        </section>
      ) : null}
      {body.output.length ? (
        <section aria-label="Codemode output">
          <ScrollFade className="max-h-48" scrollbarClassName="my-0.5">
            <div className="space-y-2 px-3 py-2">
              {body.output.map((item, index) =>
                item.type === 'image' ? (
                  <ToolImages key={index} images={[item.image]} />
                ) : (
                  <OutputText key={index} text={item.text} />
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

// The folded script: first meaningful line and a line count, quiet so the calls below lead.
function ScriptFold({ code, onOpen }: { code: string; onOpen: () => void }) {
  const lines = code.trimEnd().split('\n')
  const first = lines.find((line) => line.trim())?.trim() ?? ''
  return (
    <button
      type="button"
      aria-expanded={false}
      className="flex w-full min-w-0 items-center gap-1.5 px-3 py-1.5 text-left text-muted-foreground/70 hover:text-muted-foreground focus-visible:bg-accent/50 focus-visible:outline-none"
      onClick={onOpen}
    >
      <CodeXml className="size-3 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{first}</span>
      <span className="shrink-0 pl-2 tabular-nums">
        {lines.length} {lines.length === 1 ? 'line' : 'lines'}
      </span>
    </button>
  )
}

// The SDK joins multiple text() blocks with `==> text n/m <==` lines; quiet them so the values lead.
function OutputText({ text }: { text: string }) {
  return (
    <pre className="break-all whitespace-pre-wrap text-muted-foreground">
      {text.split(/^(==> .+ <==)$/m).map((part, index) =>
        index % 2 ? (
          <span key={index} className="text-muted-foreground/45 select-none">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </pre>
  )
}

// One compact line per nested call: tool icon, name, its main argument, then timing and status at the right edge.
function CodemodeCallRow({ call, summary }: { call: CodemodeCall; summary: string }) {
  const running = call.status === 'running'
  const failed = call.status === 'error'
  const meta = codemodeCallMeta(call)
  return (
    <div
      className="flex min-w-0 items-center gap-1.5 font-mono text-xs leading-5"
      title={call.error}
    >
      {createElement(getToolIcon(call.name), {
        className: cn('size-3 shrink-0', failed ? 'text-destructive/80' : 'text-muted-foreground'),
      })}
      {/* Children skip their own colors while running so the shimmer gradient shows through. */}
      <span
        className={cn(
          'flex min-w-0 flex-1 items-baseline gap-1.5',
          running && 'shimmer text-muted-foreground',
        )}
      >
        <span className={cn('shrink-0', !running && 'text-foreground/75')}>{call.name}</span>
        {summary ? (
          <span className={cn('min-w-0 truncate', !running && 'text-muted-foreground')}>
            {summary}
          </span>
        ) : null}
        {meta ? (
          <span
            className={cn(
              'ml-auto shrink-0 pl-2 tabular-nums',
              !running && (failed ? 'text-destructive/80' : 'text-muted-foreground/60'),
            )}
          >
            {meta}
          </span>
        ) : null}
      </span>
    </div>
  )
}
