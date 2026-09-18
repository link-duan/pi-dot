import { type ComponentProps } from 'react'
import { code } from '@streamdown/code'
import { Streamdown } from 'streamdown'
import { cn } from '@/lib/utils'
import 'streamdown/styles.css'

const plugins = { code }
const linkSafety = { enabled: false }
const controls = { code: { copy: true, download: false } }
const components = { table: MarkdownTable }

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
