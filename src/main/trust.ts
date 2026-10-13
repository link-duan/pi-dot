import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  hasTrustRequiringProjectResources,
  ProjectTrustStore,
  SettingsManager,
} from '@earendil-works/pi-coding-agent'

export type TrustDecision = 'trusted' | 'untrusted' | 'ask'

/** Whether to load the project's own resources, or ask the user first. */
export function trustDecision(cwd: string, agentDir: string): TrustDecision {
  if (!hasTrustRequiringProjectResources(cwd)) return 'trusted'
  const saved = new ProjectTrustStore(agentDir).get(cwd)
  if (saved !== null) return saved ? 'trusted' : 'untrusted'
  const fallback = SettingsManager.create(cwd, agentDir, { projectTrusted: false })
  switch (fallback.getDefaultProjectTrust()) {
    case 'always':
      return 'trusted'
    case 'never':
      return 'untrusted'
    default:
      return 'ask'
  }
}

/** The trust-requiring resources `cwd` has, for the trust prompt. */
export function trustResources(cwd: string): string[] {
  return RESOURCES.filter((path) => existsSync(join(cwd, path)))
}

const RESOURCES = [
  '.pi/extensions',
  '.pi/settings.json',
  '.pi/skills',
  '.pi/prompts',
  '.agents/skills',
]
