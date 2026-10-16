import { $getSelection, $isRangeSelection } from 'lexical'
import type { SkillInfo } from '@shared/protocol'
import { slashQuery, type SlashItem } from '@/lib/slash-query'
import { $caretTextBefore, $insertInlineWithSpace, $replaceTriggerQuery } from './caret'
import { $createSkillNode } from './SkillNode'

export function $slashQueryAtCaret(): string | null {
  const text = $caretTextBefore()
  return text == null ? null : slashQuery(text)
}

/**
 * Skills become a chip; extension commands and templates become plain `/name ` text, for their
 * arguments; built-in commands act instead, so their `/query` is just removed.
 */
export function $applySlashItem(item: SlashItem): boolean {
  if (item.kind === 'skill') return $replaceSlashQueryWithSkill(item.skill)
  const query = $slashQueryAtCaret()
  if (query == null) return false
  if (item.kind === 'command') return $replaceTriggerQuery(query, () => {})
  return $replaceTriggerQuery(query, () => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) selection.insertText(`/${item.command.name} `)
  })
}

export function $replaceSlashQueryWithSkill(skill: SkillInfo): boolean {
  const text = $caretTextBefore()
  if (text == null) return false
  const query = slashQuery(text)
  if (query == null) return false
  return $replaceTriggerQuery(query, () => {
    $insertInlineWithSpace([$createSkillNode(skill.name, skill.description)])
  })
}
