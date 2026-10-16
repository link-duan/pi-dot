import type { CSSProperties } from 'react'
import type { HighlightToken } from '@/lib/highlight'

/** A line's text, as highlighted tokens once they resolve. */
export function LineContent({ line }: { line: string | HighlightToken[] }) {
  if (typeof line === 'string') return line || ' '
  if (!line.some((token) => token.content)) return ' '
  return line.map((token, i) => <Token key={i} token={token} />)
}

function Token({ token }: { token: HighlightToken }) {
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
