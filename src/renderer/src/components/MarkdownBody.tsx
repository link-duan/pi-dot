import { isValidElement, type ComponentProps, type ReactNode } from 'react'
import { code } from '@streamdown/code'
import { CodeBlock, CodeBlockCopyButton, Streamdown, useIsCodeFenceIncomplete } from 'streamdown'
import { citationLabel, languageFromPath, parseCodeCitation } from '@/lib/code-citation'
import { cn } from '@/lib/utils'
import 'streamdown/styles.css'

const plugins = { code }
const linkSafety = { enabled: false }
const controls = { code: { copy: true, download: false } }
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
        className={cn('rounded bg-muted px-1.5 py-0.5 font-mono text-sm', className)}
        data-streamdown="inline-code"
        {...props}
      >
        {children}
      </code>
    )
  }

  const info = fenceLanguage(className)
  const citation = parseCodeCitation(info)
  const source = fenceCode(children)
  const block = (
    <CodeBlock
      code={source}
      isIncomplete={isIncomplete}
      language={citation ? languageFromPath(citation.path) : info}
      lineNumbers={Boolean(citation)}
      startLine={citation?.start}
    >
      <CodeBlockCopyButton code={source} />
    </CodeBlock>
  )
  if (!citation) return block

  const label = citationLabel(citation)
  return (
    <div className="relative" data-code-citation="" data-file-card="">
      <div
        className="pointer-events-none absolute top-2 right-10 left-2 z-[1] truncate font-mono text-xs text-muted-foreground"
        title={label}
      >
        {label}
      </div>
      {block}
    </div>
  )
}

export function MarkdownBody({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <Streamdown
      className="select-text"
      plugins={plugins}
      animated
      isAnimating={streaming}
      caret={streaming ? 'block' : undefined}
      lineNumbers={false}
      controls={controls}
      linkSafety={linkSafety}
      components={components}
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
