import { citationLabel, languageFromPath } from '@/lib/code-citation'
import type { ReadCodePreview } from '@/lib/format'
import { FileCard, HighlightedCode } from '../FileCard'

function readEndLine(code: string, startLine: number): number {
  if (!code) return startLine
  const lines = code.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return startLine + Math.max(lines.length, 1) - 1
}

export function ReadFile({ preview }: { preview: ReadCodePreview }) {
  return (
    <>
      <FileCard
        path={citationLabel({
          path: preview.path,
          start: preview.startLine,
          end: readEndLine(preview.code, preview.startLine),
        })}
        copy={preview.code}
      >
        <HighlightedCode
          source={preview.code}
          language={languageFromPath(preview.path)}
          startLine={preview.startLine}
        />
      </FileCard>
      {preview.notice ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">{preview.notice}</p>
      ) : null}
    </>
  )
}
