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
  thinkingLevels?: ThinkingLevel[]
}

export interface SkillInfo {
  name: string
  description?: string
}

export interface ContextUsage {
  tokens: number | null
  contextWindow: number
  percent: number | null
  session: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number }
  compacting: boolean
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
  steeringQueue?: string[]
  followUpQueue?: string[]
  /** Plan mode in effect for the current (or last) run. */
  planMode: boolean
  plan: PlanRef
}

/** A session's current Plan File; once built it is read-only and the next plan is a new file. */
export type PlanRef = { path: string; built: boolean } | null

/** The user message that approves a plan; the approved Plan File itself reaches the model hidden. */
export const PLAN_APPROVED_PROMPT = 'I approved the plan. Implement it.'

/** The tool the agent writes a new Plan File with. */
export const CREATE_PLAN_TOOL = 'create_plan'

/** The tool the agent asks the user questions with; its run blocks until the user replies. */
export const ASK_USER_TOOL = 'ask_user'

export interface AskQuestion {
  question: string
  options: { label: string; description?: string }[]
  multiSelect?: boolean
}

/** The labels picked for one question, plus the user's own answer if they typed one. */
export interface AskAnswer {
  selected: string[]
  other?: string
}

/** `answers[i]` answers question i; a `message` replies to all questions at once from the Composer. */
export type AskReply =
  | { kind: 'answers'; answers: AskAnswer[] }
  | { kind: 'message'; text: string }
  | { kind: 'skipped' }

/** The questions of an `ask_user` call's arguments, which may still be streaming. */
export function askQuestions(args: unknown): AskQuestion[] {
  const questions = (args as { questions?: unknown } | null)?.questions
  return Array.isArray(questions) ? (questions as AskQuestion[]) : []
}

/** An extension dialog waiting for the user; `expiresAt` (epoch ms) when it has a timeout. */
export type UiRequest = { id: string; title: string; expiresAt?: number } & (
  | { method: 'select'; options: string[] }
  | { method: 'confirm'; message: string }
  | { method: 'input'; placeholder?: string }
  | { method: 'editor'; prefill?: string }
)

export type UiResponse =
  | { kind: 'cancel' }
  | { kind: 'value'; value: string }
  | { kind: 'confirm'; confirmed: boolean }

export type WidgetPlacement = 'aboveEditor' | 'belowEditor'

export interface UiWidget {
  key: string
  lines: string[]
  placement: WidgetPlacement
}

/** What extensions show around the Composer: footer statuses and text widgets. */
export interface UiState {
  statuses: Record<string, string>
  widgets: UiWidget[]
}

export type NotifyLevel = 'info' | 'warning' | 'error'

/** A slash command from an extension or a prompt template; sending `/name args` runs it. */
export interface CommandInfo {
  name: string
  description?: string
  source: 'extension' | 'prompt'
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
  | { type: 'plan_mode'; active: boolean; plan: PlanRef }
  | { type: 'queue_update'; steering: string[]; followUp: string[] }
  | { type: 'auto_retry_start'; attempt: number; maxAttempts: number; delayMs: number }
  | { type: 'auto_retry_end' }
  | { type: 'ui_request'; request: UiRequest }
  | { type: 'ui_dismiss'; id: string }
  | { type: 'ui_state'; state: UiState }
  /** Notices with the same `id` replace each other instead of stacking. */
  | { type: 'ui_notify'; message: string; level: NotifyLevel; id?: string }
  | { type: 'ui_editor_text'; text: string }

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
  commands: CommandInfo[]
  ui: { requests: UiRequest[]; state: UiState }
  contextUsage?: ContextUsage | null
  steeringQueue?: string[]
  followUpQueue?: string[]
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
