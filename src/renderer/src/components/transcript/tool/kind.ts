import type { ToolLiveState } from '@/chat/state'
import {
  FilePenLine,
  FilePlus,
  FileText,
  Folder,
  FolderSearch,
  Search,
  Terminal,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { asText, prettyJson, toolDiffStats, toolSummary } from '@/lib/format'

export function isEditTool(name: string): boolean {
  return name.toLowerCase() === 'edit'
}

export function isReadTool(name: string): boolean {
  return name.toLowerCase() === 'read'
}

export function isWriteTool(name: string): boolean {
  return name.toLowerCase() === 'write'
}

export function isShellTool(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower === 'bash' ||
    lower.includes('command') ||
    lower.includes('exec') ||
    lower.includes('shell')
  )
}

export function getToolIcon(name: string): LucideIcon {
  const lower = name.toLowerCase()
  if (isShellTool(name)) return Terminal
  if (lower === 'grep') return Search
  if (lower === 'find') return FolderSearch
  if (isEditTool(name)) return FilePenLine
  if (isReadTool(name)) return FileText
  if (isWriteTool(name)) return FilePlus
  if (lower === 'ls') return Folder
  if (
    lower.includes('file') ||
    lower.includes('write') ||
    lower.includes('read') ||
    lower.includes('edit')
  ) {
    return FileText
  }
  if (lower.includes('search') || lower.includes('find') || lower.includes('grep')) {
    return Search
  }
  return Wrench
}

function isToolError(result: unknown): boolean {
  return Boolean(result && typeof result === 'object' && 'isError' in result && result.isError)
}

export function toolView(
  name: string,
  args: unknown,
  live?: ToolLiveState,
  result?: unknown,
  pending?: boolean,
) {
  const running = live?.status === 'running' || Boolean(pending && live?.status !== 'done')
  const payload = live?.args ?? args
  const resultText = asText(live?.result ?? live?.partialResult ?? result)
  const error = Boolean(live?.isError) || isToolError(result)
  const shell = isShellTool(name)
  const command = shell ? toolSummary(name, payload) : ''
  const rawArgs = shell ? '' : prettyJson(payload)
  const argsText = rawArgs && rawArgs !== '{}' && rawArgs !== 'null' ? rawArgs : ''
  return {
    running,
    payload,
    resultText,
    error,
    shell,
    command,
    argsText,
    hasDetails: Boolean(command || argsText || resultText),
    stats: toolDiffStats(name, payload, live?.result ?? result),
  }
}
