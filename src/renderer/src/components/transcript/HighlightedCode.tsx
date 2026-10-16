import { useDeferredValue } from 'react'
import type { HighlightToken } from '@/lib/highlight'
import { FileCardLine } from './FileCardLine'
import { Highlighted } from './Highlighted'
import { LineContent } from './LineContent'

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
  const view = (tokens?: HighlightToken[][]) =>
    lines.map((text, i) => (
      <FileCardLine key={i} n={startLine + i} gutterCh={gutterCh}>
        <LineContent line={tokens?.[i] ?? text} />
      </FileCardLine>
    ))
  return (
    <Highlighted source={deferred} language={language} pending={pending} fallback={view()}>
      {view}
    </Highlighted>
  )
}

function splitLines(source: string) {
  const lines = source.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines.length ? lines : ['']
}
