import type { SettingsSection } from '@shared/settings'

export const PATH = {
  picker: '/',
  session: '/session',
  settings: '/settings',
  playground: '/playground',
} as const

const SECTIONS: SettingsSection[] = ['general', 'models', 'providers']

export function parseSection(value: string | null): SettingsSection {
  return SECTIONS.includes(value as SettingsSection) ? (value as SettingsSection) : 'general'
}

export function settingsPath(section: SettingsSection = 'general'): string {
  return `${PATH.settings}?section=${section}`
}

export function initialEntry(cwd?: string | null): string {
  if (cwd) return PATH.session
  return PATH.picker
}
