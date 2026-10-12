import {
  FilePenLine,
  FilePlus,
  FileText,
  Folder,
  FolderSearch,
  ImageIcon,
  Search,
  SquareCode,
  Terminal,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { CREATE_PLAN_TOOL } from '@shared/protocol'
import { isImageFile } from '@/lib/path'

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

const TOOL_LABELS: Record<string, string> = {
  bash: 'Bash',
  codemode: 'Codemode',
  grep: 'Grep',
  edit: 'Edit',
  read: 'Read',
  write: 'Write',
  find: 'Find',
  ls: 'Ls',
  [CREATE_PLAN_TOOL]: 'Create Plan',
}

export function toolLabel(name: string): string {
  return TOOL_LABELS[name.toLowerCase()] ?? name
}

export function isCollapsedToolAttempt(name: string, error: boolean): boolean {
  if (!error) return false
  const lower = name.toLowerCase()
  return lower === 'edit' || lower === 'write'
}

export function getToolIcon(name: string, path?: string | null, hasImage = false): LucideIcon {
  if (hasImage) return ImageIcon
  const lower = name.toLowerCase()
  if (lower === 'codemode') return SquareCode
  if (isShellTool(name)) return Terminal
  if (lower === 'grep') return Search
  if (lower === 'find') return FolderSearch
  if (isEditTool(name)) return FilePenLine
  if (isReadTool(name)) {
    if (isImageFile(path)) return ImageIcon
    return FileText
  }
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

export function isToolError(result: unknown): boolean {
  return Boolean(result && typeof result === 'object' && 'isError' in result && result.isError)
}
