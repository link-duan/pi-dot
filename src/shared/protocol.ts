export type ConnectionStatus = 'disconnected' | 'connecting' | 'ready' | 'error'

export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

export type ThinkingLevel = (typeof THINKING_LEVELS)[number]

export const THINKING_LEVEL_LABELS: Record<ThinkingLevel, string> = {
  off: 'Off',
  minimal: 'Min',
  low: 'Low',
  medium: 'Med',
  high: 'High',
  xhigh: 'xHigh',
  max: 'Max',
}

export function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return typeof value === 'string' && (THINKING_LEVELS as readonly string[]).includes(value)
}

export function asThinkingLevel(value: unknown): ThinkingLevel | undefined {
  return isThinkingLevel(value) ? value : undefined
}

export function parseThinkingLevels(value: unknown): ThinkingLevel[] {
  if (!Array.isArray(value)) return ['off']
  const levels = value.filter(isThinkingLevel)
  return levels.length > 0 ? levels : ['off']
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
}

export interface SkillInfo {
  name: string
  description?: string
}

export interface ContextUsage {
  tokens: number | null
  contextWindow: number
  percent: number | null
}

export interface FileHit {
  path: string
  isDirectory: boolean
}

export interface ModelSelection {
  model: ModelInfo
  thinkingLevel: ThinkingLevel
  thinkingLevels: ThinkingLevel[]
}

export interface SessionState {
  model?: ModelInfo | null
  thinkingLevel: ThinkingLevel
  isStreaming: boolean
  sessionFile?: string
  sessionId?: string
  messageCount: number
}

export interface TextContent {
  type: 'text'
  text: string
}

export interface ThinkingContent {
  type: 'thinking'
  thinking: string
}

export interface ImageContent {
  type: 'image'
  data?: string
  mimeType?: string
}

export interface ToolCallContent {
  type: 'toolCall'
  id: string
  name: string
  arguments: unknown
}

export type ContentBlock = TextContent | ThinkingContent | ImageContent | ToolCallContent

export interface UserMessage {
  role: 'user'
  content: string | ContentBlock[]
  timestamp: number
}

export interface AssistantMessage {
  role: 'assistant'
  content: ContentBlock[]
  model?: string
  provider?: string
  stopReason?: string
  errorMessage?: string
  timestamp: number
}

export interface ToolResultMessage {
  role: 'toolResult'
  toolCallId: string
  toolName: string
  content: ContentBlock[]
  details?: unknown
  isError: boolean
  timestamp: number
}

export interface CompactionSummaryMessage {
  role: 'compactionSummary'
  summary: string
  timestamp: number
}

export type AgentMessage =
  | UserMessage
  | AssistantMessage
  | ToolResultMessage
  | CompactionSummaryMessage

export type SessionEventBody =
  | { type: 'agent_start' }
  | { type: 'agent_end'; willRetry?: boolean }
  | { type: 'message_start'; message: AgentMessage }
  | { type: 'message_update'; message: AgentMessage }
  | { type: 'message_end'; message: AgentMessage }
  | { type: 'tool_execution_start'; toolCallId: string; toolName: string; args?: unknown }
  | {
      type: 'tool_execution_update'
      toolCallId: string
      toolName: string
      args?: unknown
      partialResult?: unknown
    }
  | {
      type: 'tool_execution_end'
      toolCallId: string
      toolName: string
      result?: unknown
      isError?: boolean
    }
  | { type: 'context_usage'; usage: ContextUsage | null }

export type SessionEvent = SessionEventBody & { sessionFile: string }

export interface SessionSnapshot {
  cwd: string
  state: SessionState
  messages: AgentMessage[]
  messagePersistedAt?: number[]
  models: ModelInfo[]
  thinkingLevels: ThinkingLevel[]
  runningSessionFiles: string[]
  skills: SkillInfo[]
  contextUsage?: ContextUsage | null
}

export type StartResult =
  | { kind: 'started'; snapshot: SessionSnapshot }
  | { kind: 'focused' }
  | { kind: 'cancelled' }

export interface SessionListItem {
  id: string
  path: string
  modified: string
  name?: string
  firstMessage?: string
  messageCount: number
  running?: boolean
}

const MESSAGE_ROLES = new Set<string>(['user', 'assistant', 'toolResult', 'compactionSummary'])

export function isAgentMessage(value: unknown): value is AgentMessage {
  if (!value || typeof value !== 'object') return false
  return MESSAGE_ROLES.has((value as { role?: unknown }).role as string)
}
