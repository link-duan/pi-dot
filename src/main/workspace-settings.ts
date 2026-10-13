import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { applyEdits, findNodeAtLocation, modify, parseTree, type Node } from 'jsonc-parser'
import {
  GENERAL_FIELDS,
  generalField,
  isFieldValue,
  type GeneralKey,
  type GeneralSettings,
  type WorkspacePatch,
} from '@shared/settings'

const JSONC_FORMAT = {
  formattingOptions: { tabSize: 2, insertSpaces: true, eol: '\n' },
}

export function workspaceSettingsPath(cwd: string): string {
  return join(cwd, '.pi', 'settings.json')
}

/** The general settings `<cwd>/.pi/settings.json` sets, skipping user-only and invalid values. */
export function readWorkspaceOverrides(cwd: string): Partial<GeneralSettings> {
  const path = workspaceSettingsPath(cwd)
  if (!existsSync(path)) return {}
  const tree = parseTree(readFileSync(path, 'utf8'))
  if (!tree) return {}
  const overrides: Record<string, unknown> = {}
  for (const field of GENERAL_FIELDS) {
    if (!field.path || field.userOnly) continue
    const node = findNodeAtLocation(tree, field.path)
    if (node && isFieldValue(field, node.value)) overrides[field.key] = node.value
  }
  return overrides as Partial<GeneralSettings>
}

export function writeWorkspaceOverrides(cwd: string, patch: WorkspacePatch): void {
  const path = workspaceSettingsPath(cwd)
  let text = existsSync(path) ? readFileSync(path, 'utf8') : '{}\n'
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const field = generalField(key as GeneralKey)
    if (!field.path || field.userOnly) throw new Error(`${key} is a user-only setting`)
    if (value !== null && !isFieldValue(field, value)) throw new Error(`Invalid value for ${key}`)
    text = applyEdits(text, modify(text, field.path, value ?? undefined, JSONC_FORMAT))
    if (value === null) text = removeEmptyParents(text, field.path)
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`)
}

function removeEmptyParents(text: string, path: string[]): string {
  for (let depth = path.length - 1; depth > 0; depth--) {
    const parent = path.slice(0, depth)
    const tree = parseTree(text)
    const node: Node | undefined = tree && findNodeAtLocation(tree, parent)
    if (!node || node.type !== 'object' || node.children?.length) break
    text = applyEdits(text, modify(text, parent, undefined, JSONC_FORMAT))
  }
  return text
}
