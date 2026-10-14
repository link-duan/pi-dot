import type { AgentSession } from '@earendil-works/pi-coding-agent'
import { clampThinkingLevel } from '@earendil-works/pi-ai'
import { modelKey } from '@shared/protocol'

const TITLE_TIMEOUT_MS = 60_000
const MAX_INPUT_CHARS = 2000
const MAX_TITLE_CHARS = 60

const SYSTEM_PROMPT = [
  'Generate a short title for a coding-assistant conversation, based on the user request.',
  'Use the same language as the request. At most 8 words (or 20 CJK characters).',
  'Output only the title, without quotes or trailing punctuation.',
].join('\n')

export async function generateSessionTitle(
  session: AgentSession,
  text: string,
  key: string,
): Promise<string | undefined> {
  const runtime = session.modelRuntime
  const model =
    runtime.getAvailableSnapshot().find((item) => modelKey(item) === key) ?? session.model
  if (!model) return undefined
  // Models that cannot disable reasoning fall back to their lowest supported level.
  const level = clampThinkingLevel(model, 'off')
  const reply = await runtime.completeSimple(
    model,
    {
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.slice(0, MAX_INPUT_CHARS), timestamp: Date.now() }],
    },
    {
      ...(level === 'off' ? {} : { reasoning: level }),
      maxTokens: 1024,
      signal: AbortSignal.timeout(TITLE_TIMEOUT_MS),
    },
  )
  if (reply.stopReason === 'error' || reply.stopReason === 'aborted') {
    throw new Error(reply.errorMessage ?? `Title generation ${reply.stopReason}`)
  }
  const raw = reply.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
  return cleanTitle(raw)
}

export function cleanTitle(raw: string): string | undefined {
  const line = raw
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean)
  if (!line) return undefined
  const title = line
    .replace(/^#+\s*/, '')
    .replace(/^title\s*[:：]\s*/i, '')
    .replace(/^["'“”‘’「『`*\s]+/, '')
    .replace(/["'“”‘’」』`*.。!！?？,，;；:：\s]+$/, '')
    .trim()
  if (!title) return undefined
  return title.length > MAX_TITLE_CHARS ? `${title.slice(0, MAX_TITLE_CHARS - 1)}…` : title
}
