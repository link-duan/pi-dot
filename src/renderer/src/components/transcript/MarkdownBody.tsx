import { isValidElement, useContext, useState, type ComponentProps, type ReactNode } from 'react'
import { createMathPlugin } from '@streamdown/math'
import {
  Streamdown,
  StreamdownContext,
  useIsCodeFenceIncomplete,
  type StreamdownProps,
} from 'streamdown'
import { citationLabel, languageFromPath, parseCodeCitation } from '@/lib/code-citation'
import { cn } from '@/lib/utils'
import { FileCard } from './FileCard'
import { HighlightedCode } from './HighlightedCode'
import { MermaidCard } from './MermaidCard'
import 'katex/dist/katex.min.css'
import 'streamdown/styles.css'

const linkSafety = { enabled: false }
const animation = {
  animation: 'blurReveal',
  duration: 420,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  sep: 'word',
} as const
const mathPlugin = createMathPlugin({ singleDollarTextMath: true })
const plugins = { math: mathPlugin }
const components = { table: MarkdownTable, code: MarkdownCode }
const LANGUAGE_CLASS = /language-([^\s]+)/

function fenceLanguage(className?: string): string {
  return className?.match(LANGUAGE_CLASS)?.[1] ?? ''
}

function fenceCode(children: ReactNode): string {
  if (
    isValidElement<{ children?: unknown }>(children) &&
    typeof children.props.children === 'string'
  ) {
    return children.props.children
  }
  return typeof children === 'string' ? children : ''
}

/** Word animation only reaches text, so cards mounted mid-stream reveal themselves. */
function useStreamReveal(): string | undefined {
  const { isAnimating } = useContext(StreamdownContext)
  const [reveal] = useState(() => isAnimating)
  return reveal ? 'animate-blur-reveal' : undefined
}

function MarkdownCode({
  className,
  children,
  node: _node,
  ...props
}: ComponentProps<'code'> & { node?: unknown }) {
  const isIncomplete = useIsCodeFenceIncomplete()
  const reveal = useStreamReveal()
  if (!('data-block' in props)) {
    return (
      <code
        className={cn(
          'rounded bg-muted box-decoration-clone px-1.5 py-0.5 font-mono text-[0.85em] dark:bg-muted/70',
          className,
        )}
        data-streamdown="inline-code"
        {...props}
      >
        {children}
      </code>
    )
  }

  const info = fenceLanguage(className)
  const source = fenceCode(children)

  if (info === 'mermaid') {
    return <MermaidCard code={source} isIncomplete={isIncomplete} className={reveal} />
  }

  const citation = parseCodeCitation(info)
  return (
    <FileCard
      path={citation ? citationLabel(citation) : info || 'code'}
      copy={source}
      className={reveal}
    >
      <HighlightedCode
        source={source}
        language={citation ? languageFromPath(citation.path) : info}
        startLine={citation?.start ?? 1}
        pending={isIncomplete}
      />
    </FileCard>
  )
}

export function MarkdownBody({
  text,
  streaming = false,
  className,
  ...blocks
}: {
  text: string
  streaming?: boolean
  className?: string
} & Pick<StreamdownProps, 'BlockComponent' | 'parseMarkdownIntoBlocksFn'>) {
  return (
    <Streamdown
      className={cn('leading-relaxed select-text [text-autospace:normal]', className)}
      animated={animation}
      isAnimating={streaming}
      caret={streaming ? 'block' : undefined}
      lineNumbers={false}
      linkSafety={linkSafety}
      plugins={plugins}
      components={components}
      // Custom blocks must be exact slices of the source, so skip the streaming repairs then.
      parseIncompleteMarkdown={streaming || !blocks.parseMarkdownIntoBlocksFn}
      {...blocks}
    >
      {text}
    </Streamdown>
  )
}

function MarkdownTable({
  children,
  className,
  node: _node,
  ...props
}: ComponentProps<'table'> & { node?: unknown }) {
  const reveal = useStreamReveal()
  return (
    <div
      data-wide=""
      className={cn('my-4 max-h-[900px] overflow-auto rounded-lg border border-border p-2', reveal)}
    >
      <table className={cn('w-full divide-y divide-border', className)} {...props}>
        {children}
      </table>
    </div>
  )
}
