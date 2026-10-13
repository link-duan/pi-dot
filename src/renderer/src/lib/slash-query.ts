import type { CommandInfo, SkillInfo } from '@shared/protocol'
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
  { name: 'compact', description: 'Summarize the conversation to free context' },
  { name: 'new', description: 'Start a new session' },
]

export type SlashItem =
  | ({ kind: 'command' } & SlashCommand)
  | { kind: 'extension'; command: CommandInfo }
  | { kind: 'skill'; skill: SkillInfo }

/**
 * Built-in commands, then extension commands and prompt templates, then skills. A name taken by
 * an earlier one is dropped, as pi resolves it. A `skill:` query, or `extensions: null`, lists
 * skills only.
 */
export function filterSlashItems(
  skills: SkillInfo[],
  query: string,
  extensions: CommandInfo[] | null = [],
): SlashItem[] {
  const needle = query.trim().toLowerCase()
  const listCommands = extensions !== null && !needle.startsWith('skill:')
  const builtins = listCommands
    ? SLASH_COMMANDS.filter((command) => command.name.includes(needle))
    : []
  const taken = new Set(SLASH_COMMANDS.map((command) => command.name))
  const others = listCommands
    ? extensions!.filter((command) => {
        if (taken.has(command.name)) return false
        taken.add(command.name)
        return (
          command.name.toLowerCase().includes(needle) ||
          (command.description?.toLowerCase().includes(needle) ?? false)
        )
      })
    : []
  return [
    ...builtins.map((command): SlashItem => ({ kind: 'command', ...command })),
    ...others.map((command): SlashItem => ({ kind: 'extension', command })),
    ...filterSkills(skills, query).map((skill): SlashItem => ({ kind: 'skill', skill })),
  ]
}

/** The extension command `text` runs, if any; it runs in main without a user message. */
export function extensionCommand(text: string, commands: CommandInfo[]): CommandInfo | undefined {
  const name = text.match(/^\/(\S+)/)?.[1]
  return name
    ? commands.find((command) => command.source === 'extension' && command.name === name)
    : undefined
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
