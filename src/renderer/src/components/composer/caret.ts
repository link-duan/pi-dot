import { $getSelection, $isRangeSelection, $isTextNode, type LexicalNode } from 'lexical'

export function $caretTextBefore(): string | null {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null
  const node = selection.anchor.getNode()
  if (!$isTextNode(node)) return null
  return node.getTextContent().slice(0, selection.anchor.offset)
}

export function $replaceTriggerQuery(query: string, insert: () => void): boolean {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false
  const node = selection.anchor.getNode()
  if (!$isTextNode(node)) return false
  const offset = selection.anchor.offset
  const start = offset - query.length - 1
  if (start < 0) return false
  selection.setTextNodeRange(node, start, node, offset)
  selection.removeText()
  insert()
  return true
}

export function $insertInlineWithSpace(nodes: LexicalNode[]): void {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return
  selection.insertNodes(nodes)
  if (!$nextCharIsSpace()) selection.insertText(' ')
}

function $nextCharIsSpace(): boolean {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false
  const caret = selection.anchor.getNode()
  if (!$isTextNode(caret)) return false
  const ch = caret.getTextContent()[selection.anchor.offset]
  return ch != null && /\s/.test(ch)
}
