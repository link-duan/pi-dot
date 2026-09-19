import type { SkillInfo } from '@shared/protocol'

export function slashQuery(textBeforeCaret: string): string | null {
  const match = textBeforeCaret.match(/(?:^|\s)(\/[^\s]*)$/)
  if (!match) return null
  return match[1]!.slice(1)
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
