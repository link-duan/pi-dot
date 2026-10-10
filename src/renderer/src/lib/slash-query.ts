import type { SkillInfo } from '@shared/protocol'
import { tokenQuery } from './token-query'

export function slashQuery(textBeforeCaret: string): string | null {
  return tokenQuery(textBeforeCaret, '/')
}

export interface SlashCommand {
  name: string
  description: string
}

/** Built-in commands the Composer handles itself; they are never sent to the agent. */
export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'plan', description: 'Plan before making changes' },
]

export type SlashItem = ({ kind: 'command' } & SlashCommand) | { kind: 'skill'; skill: SkillInfo }

/** Commands first, then skills; a `skill:` query lists skills only. */
export function filterSlashItems(skills: SkillInfo[], query: string): SlashItem[] {
  const needle = query.trim().toLowerCase()
  const commands = needle.startsWith('skill:')
    ? []
    : SLASH_COMMANDS.filter((command) => command.name.includes(needle))
  return [
    ...commands.map((command): SlashItem => ({ kind: 'command', ...command })),
    ...filterSkills(skills, query).map((skill): SlashItem => ({ kind: 'skill', skill })),
  ]
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
