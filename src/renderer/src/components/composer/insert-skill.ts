import type { SkillInfo } from '@shared/protocol'
import { slashQuery, type SlashItem } from '@/lib/slash-query'
import { $caretTextBefore, $insertInlineWithSpace, $replaceTriggerQuery } from './caret'
import { $createSkillNode } from './SkillNode'

export function $slashQueryAtCaret(): string | null {
  const text = $caretTextBefore()
  return text == null ? null : slashQuery(text)
}

/** Skills become a chip; commands act instead, so their `/query` is just removed. */
export function $applySlashItem(item: SlashItem): boolean {
  if (item.kind === 'skill') return $replaceSlashQueryWithSkill(item.skill)
  const query = $slashQueryAtCaret()
  return query != null && $replaceTriggerQuery(query, () => {})
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
