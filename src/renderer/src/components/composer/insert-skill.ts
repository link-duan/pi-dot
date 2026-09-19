import type { SkillInfo } from '@shared/protocol'
import { slashQuery } from '@/lib/slash-query'
import { $caretTextBefore, $insertInlineWithSpace, $replaceTriggerQuery } from './caret'
import { $createSkillNode } from './SkillNode'

export function $slashQueryAtCaret(): string | null {
  const text = $caretTextBefore()
  return text == null ? null : slashQuery(text)
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
