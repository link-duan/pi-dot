import type { FileHit } from '@shared/protocol'
import { atQuery } from '@/lib/at-query'
import { $caretTextBefore, $insertInlineWithSpace, $replaceTriggerQuery } from './caret'
import { $createFileNode } from './FileNode'

export function $atQueryAtCaret(): string | null {
  const text = $caretTextBefore()
  return text == null ? null : atQuery(text)
}

export function $replaceAtQueryWithFile(hit: FileHit): boolean {
  const text = $caretTextBefore()
  if (text == null) return false
  const query = atQuery(text)
  if (query == null) return false
  return $replaceTriggerQuery(query, () => {
    $insertFilePath(filePathFromHit(hit))
  })
}

export function $insertFilePath(path: string): void {
  $insertInlineWithSpace([$createFileNode(path)])
}

export function filePathFromHit(hit: FileHit): string {
  if (!hit.isDirectory) return hit.path
  const trimmed = hit.path.replace(/\/+$/, '')
  return `${trimmed}/`
}
