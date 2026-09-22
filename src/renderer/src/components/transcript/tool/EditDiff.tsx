import { languageFromPath } from '@/lib/code-citation'
import { formatDiffCopy, type DiffLine, type DiffStats } from './diff'
import { FileCard, HighlightedDiff } from '../FileCard'

export function EditDiff({
  path,
  stats,
  lines,
}: {
  path: string
  stats?: DiffStats | null
  lines: DiffLine[]
}) {
  return (
    <FileCard path={path || 'Diff'} stats={stats} copy={formatDiffCopy(lines)}>
      <HighlightedDiff lines={lines} language={languageFromPath(path)} />
    </FileCard>
  )
}
