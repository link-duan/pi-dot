import { $getSelection, $isRangeSelection, $isTextNode } from 'lexical'
import type { SkillInfo } from '@shared/protocol'
import { slashQuery } from '@/lib/slash-query'
import { $createSkillNode } from './SkillNode'

export function $slashQueryAtCaret(): string | null {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null
  const node = selection.anchor.getNode()
  if (!$isTextNode(node)) return null
  return slashQuery(node.getTextContent().slice(0, selection.anchor.offset))
}

export function $replaceSlashQueryWithSkill(skill: SkillInfo): boolean {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false
  const node = selection.anchor.getNode()
  if (!$isTextNode(node)) return false
  const offset = selection.anchor.offset
  const query = slashQuery(node.getTextContent().slice(0, offset))
  if (query == null) return false
  const start = offset - query.length - 1
  selection.setTextNodeRange(node, start, node, offset)
  selection.removeText()
  selection.insertNodes([$createSkillNode(skill.name, skill.description)])
  if (!$nextCharIsSpace()) selection.insertText(' ')
  return true
}

function $nextCharIsSpace(): boolean {
  const selection = $getSelection()
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false
  const caret = selection.anchor.getNode()
  if (!$isTextNode(caret)) return false
  const ch = caret.getTextContent()[selection.anchor.offset]
  return ch != null && /\s/.test(ch)
}
