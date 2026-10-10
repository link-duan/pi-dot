import { isValidElement, type ComponentProps, type ReactNode } from 'react'
import { createMathPlugin } from '@streamdown/math'
import { Streamdown, useIsCodeFenceIncomplete, type StreamdownProps } from 'streamdown'
import { citationLabel, languageFromPath, parseCodeCitation } from '@/lib/code-citation'
import { cn } from '@/lib/utils'
import { FileCard, HighlightedCode } from './FileCard'
import { MermaidCard } from './MermaidCard'
import 'katex/dist/katex.min.css'
import 'streamdown/styles.css'

const linkSafety = { enabled: false }
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

function MarkdownCode({
  className,
  children,
  node: _node,
  ...props
}: ComponentProps<'code'> & { node?: unknown }) {
  const isIncomplete = useIsCodeFenceIncomplete()
  if (!('data-block' in props)) {
    return (
      <code
        className={cn(
          'inline-block rounded bg-muted px-1.5 py-0.5 align-middle font-mono text-[0.85em] leading-none',
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
    return <MermaidCard code={source} isIncomplete={isIncomplete} />
  }

  const citation = parseCodeCitation(info)
  return (
    <FileCard path={citation ? citationLabel(citation) : info || 'code'} copy={source}>
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
      className={cn('leading-relaxed select-text', className)}
      animated
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
  return (
    <div className="my-4 max-h-[900px] overflow-auto rounded-lg border border-border p-2">
      <table className={cn('w-full divide-y divide-border', className)} {...props}>
        {children}
      </table>
    </div>
  )
}
