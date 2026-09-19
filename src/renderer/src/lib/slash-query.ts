import type { SkillInfo } from '@shared/protocol'
import { tokenQuery } from './token-query'

export function slashQuery(textBeforeCaret: string): string | null {
  return tokenQuery(textBeforeCaret, '/')
}

export function filterSkills(skills: SkillInfo[], query: string): SkillInfo[] {
  const raw = query.trim().toLowerCase()
  const needle = raw.startsWith('skill:') ? raw.slice(6) : raw
  if (!needle) return skills
  return skills.filter((skill) => {
    if (skill.name.toLowerCase().includes(needle)) return true
    return skill.description?.toLowerCase().includes(needle) ?? false
  })
}
