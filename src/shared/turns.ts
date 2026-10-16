import { isAgentMessage, isLoopEdit, type AgentMessage } from './protocol'

/** A user message starts a turn, and so does the user changing a loop's prompt, which runs it. */
export function startsTurn(message: AgentMessage): boolean {
  return message.role === 'user' || isLoopEdit(message)
}

/** Each turn runs from a message that starts one through the message before the next. */
export function turnRanges(messages: AgentMessage[]): Array<{ start: number; end: number }> {
  const turns: Array<{ start: number; end: number }> = []
  let start = -1
  for (let i = 0; i < messages.length; i++) {
    if (!startsTurn(messages[i]!)) continue
    if (start >= 0) turns.push({ start, end: i - 1 })
    start = i
  }
  if (start >= 0) turns.push({ start, end: messages.length - 1 })
  return turns
}

export function alignPersistedAt(
  messages: AgentMessage[],
  records: Array<{ role: string; messageTimestamp: number; persistedAt: number }>,
): number[] {
  const buckets = new Map<string, number[]>()
  for (const record of records) {
    const key = `${record.role}:${record.messageTimestamp}`
    const list = buckets.get(key)
    if (list) list.push(record.persistedAt)
    else buckets.set(key, [record.persistedAt])
  }
  return messages.map((message) => {
    const key = `${message.role}:${message.timestamp}`
    return buckets.get(key)?.shift() ?? message.timestamp
  })
}

export function persistRecordsFromEntries(
  entries: Array<{ type: string; timestamp: string; message?: unknown }>,
): Array<{ role: string; messageTimestamp: number; persistedAt: number }> {
  const records: Array<{ role: string; messageTimestamp: number; persistedAt: number }> = []
  for (const entry of entries) {
    if (entry.type !== 'message' || !isAgentMessage(entry.message)) continue
    const persistedAt = Date.parse(entry.timestamp)
    records.push({
      role: entry.message.role,
      messageTimestamp: entry.message.timestamp,
      persistedAt: Number.isFinite(persistedAt) ? persistedAt : entry.message.timestamp,
    })
  }
  return records
}

export function estimateTurnMs(
  messages: AgentMessage[],
  persistedAt: number[],
  turn: { start: number; end: number },
): number | null {
  const start = persistedAt[turn.start] ?? messages[turn.start]?.timestamp
  const end = persistedAt[turn.end] ?? messages[turn.end]?.timestamp
  if (typeof start !== 'number' || typeof end !== 'number') return null
  const ms = end - start
  return ms >= 1000 ? ms : null
}
