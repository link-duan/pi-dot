import { Suspense, use, useDeferredValue, type CSSProperties, type ReactNode } from 'react'
import { CodeBlockCopyButton } from 'streamdown'
import { DiffStatsLabel } from './ActivityRow'
import { highlight, type HighlightToken } from '@/lib/highlight'
import type { DiffLine, DiffStats } from './tool/diff'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ScrollFade } from '@/components/ui/scroll-area'

type Token = HighlightToken
type Line = string | Token[]

const DIFF_ROW: Record<DiffLine['kind'], string> = {
  add: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  remove: 'bg-destructive/10 text-destructive',
  context: 'text-muted-foreground',
}

const DIFF_MARK: Record<DiffLine['kind'], string> = { add: '+', remove: '-', context: ' ' }

export function FileCard({
  path,
  stats,
  copy,
  className,
  children,
}: {
  path: string
  stats?: DiffStats | null
  copy: string
  className?: string
  children: ReactNode
}) {
  return (
    <div data-wide="" className={cn('mt-2 w-full rounded-xl border border-border pt-2', className)}>
      <div className="flex items-center gap-2 px-2">
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          {path ? (
            <Tooltip>
              <TooltipTrigger
                render={<span />}
                className="min-w-0 cursor-default truncate font-mono text-xs text-muted-foreground"
              >
                {path}
              </TooltipTrigger>
              <TooltipContent className="max-w-lg font-mono text-xs break-all">
                {path}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {stats ? <DiffStatsLabel stats={stats} /> : null}
        </span>
        <CodeBlockCopyButton code={copy} />
      </div>
      <ScrollFade
        rootClassName="mt-2 border-t border-border"
        className="max-h-96 py-2 font-mono text-xs leading-relaxed"
        scrollbarClassName="my-0.5"
      >
        {children}
      </ScrollFade>
    </div>
  )
}

function FileCardLine({
  n,
  gutterCh,
  marker,
  className,
  children,
}: {
  n?: number
  gutterCh: number
  marker?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex items-baseline gap-2 py-px pr-2 whitespace-pre-wrap', className)}>
      <span className="shrink-0 px-2 text-right text-xs text-muted-foreground/50 tabular-nums select-none">
        <span className="inline-block" style={{ width: `${gutterCh}ch` }}>
          {n ?? ''}
        </span>
      </span>
      {marker != null ? <span className="w-3 shrink-0 select-none">{marker}</span> : null}
      <span className="min-w-0">{children}</span>
    </div>
  )
}

export function HighlightedCode({
  source,
  language,
  startLine = 1,
  pending = false,
}: {
  source: string
  language: string
  startLine?: number
  pending?: boolean
}) {
  // While the source grows, keep the previous highlight on screen until the new tokens resolve.
  const deferred = useDeferredValue(source)
  const lines = splitLines(deferred)
  const gutterCh = Math.max(1, String(startLine + lines.length - 1).length)
  const view = (tokens?: Token[][]) =>
    lines.map((text, i) => (
      <FileCardLine key={i} n={startLine + i} gutterCh={gutterCh}>
        {lineContent(tokens?.[i] ?? text)}
      </FileCardLine>
    ))
  return (
    <Highlighted source={deferred} language={language} pending={pending} fallback={view()}>
      {view}
    </Highlighted>
  )
}

export function HighlightedDiff({
  lines: source,
  language,
}: {
  lines: DiffLine[]
  language: string
}) {
  // Edit/write diffs grow with streaming arguments; keep the previous highlight like HighlightedCode.
  const lines = useDeferredValue(source)
  const gutterCh = Math.max(1, ...lines.map((line) => String(lineNo(line) ?? '').length))
  const view = (tokens?: Token[][]) =>
    lines.map((line, i) => (
      <FileCardLine
        key={i}
        n={lineNo(line)}
        gutterCh={gutterCh}
        marker={DIFF_MARK[line.kind]}
        className={cn(DIFF_ROW[line.kind], line.hunkStart && 'mt-2')}
      >
        {lineContent(tokens?.[i] ?? line.text)}
      </FileCardLine>
    ))
  return (
    <Highlighted
      source={lines.map((line) => line.text).join('\n')}
      language={language}
      fallback={view()}
    >
      {view}
    </Highlighted>
  )
}

function Highlighted({
  source,
  language,
  pending,
  fallback,
  children,
}: {
  source: string
  language: string
  pending?: boolean
  fallback: ReactNode
  children: (tokens: Token[][]) => ReactNode
}) {
  if (pending) return fallback
  return (
    <Suspense fallback={fallback}>
      <Resolve source={source} language={language}>
        {children}
      </Resolve>
    </Suspense>
  )
}

function Resolve({
  source,
  language,
  children,
}: {
  source: string
  language: string
  children: (tokens: Token[][]) => ReactNode
}) {
  return children(useHighlight(source, language).tokens)
}

function lineContent(line: Line) {
  if (typeof line === 'string') return line || ' '
  if (!line.some((token) => token.content)) return ' '
  return line.map((token, i) => <Token key={i} token={token} />)
}

function Token({ token }: { token: Token }) {
  return (
    <span
      className="text-[var(--sdm-c,inherit)] dark:text-[var(--shiki-dark,var(--sdm-c,inherit))]"
      style={
        {
          '--sdm-c': token.color ?? token.htmlStyle?.color,
          '--shiki-dark': token.htmlStyle?.['--shiki-dark'],
        } as CSSProperties
      }
      {...token.htmlAttrs}
    >
      {token.content}
    </span>
  )
}

function useHighlight(source: string, language: string) {
  return use(highlight(source, language))
}

function splitLines(source: string) {
  const lines = source.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines.length ? lines : ['']
}

function lineNo(line: DiffLine) {
  return line.kind === 'remove' ? line.oldLine : (line.newLine ?? line.oldLine)
}
