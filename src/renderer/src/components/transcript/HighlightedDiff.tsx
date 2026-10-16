import { useDeferredValue } from 'react'
import type { HighlightToken } from '@/lib/highlight'
import type { DiffLine } from '@/components/transcript/tool/diff'
import { cn } from '@/lib/utils'
import { FileCardLine } from './FileCardLine'
import { Highlighted } from './Highlighted'
import { LineContent } from './LineContent'

const DIFF_ROW: Record<DiffLine['kind'], string> = {
  add: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  remove: 'bg-destructive/10 text-destructive',
  context: 'text-muted-foreground',
}

const DIFF_MARK: Record<DiffLine['kind'], string> = { add: '+', remove: '-', context: ' ' }

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
  const view = (tokens?: HighlightToken[][]) =>
    lines.map((line, i) => (
      <FileCardLine
        key={i}
        n={lineNo(line)}
        gutterCh={gutterCh}
        marker={DIFF_MARK[line.kind]}
        className={cn(DIFF_ROW[line.kind], line.hunkStart && 'mt-2')}
      >
        <LineContent line={tokens?.[i] ?? line.text} />
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

function lineNo(line: DiffLine) {
  return line.kind === 'remove' ? line.oldLine : (line.newLine ?? line.oldLine)
}
