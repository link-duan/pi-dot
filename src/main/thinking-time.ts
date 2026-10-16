import type { ExtensionFactory, MessageEndEvent } from '@earendil-works/pi-coding-agent'

type AgentMessage = MessageEndEvent['message']

export interface ThinkingTime {
  extension: ExtensionFactory
  /** The message with each finished thinking block of the streaming reply carrying its `durationMs`. */
  stamp<T extends AgentMessage>(message: T): T
}

/**
 * Times the streaming reply's thinking blocks and writes `durationMs` onto them when the reply
 * ends, so the session file keeps it. `durationMs` is Pi Dot's own field on pi's thinking block;
 * providers rebuild blocks field by field when replaying, so it never reaches the model.
 */
export function createThinkingTime(): ThinkingTime {
  /** Per `contentIndex` of the streaming reply. */
  let startedAt: number[] = []
  let durations: number[] = []

  const stamp = <T extends AgentMessage>(message: T): T => {
    if (message.role !== 'assistant' || durations.length === 0) return message
    return {
      ...message,
      content: message.content.map((block, index) =>
        block.type === 'thinking' && durations[index] != null
          ? { ...block, durationMs: durations[index] }
          : block,
      ),
    }
  }

  const extension: ExtensionFactory = (pi) => {
    pi.on('message_start', (event) => {
      if (event.message.role !== 'assistant') return
      startedAt = []
      durations = []
    })

    pi.on('message_update', ({ assistantMessageEvent: update }) => {
      if (!('contentIndex' in update)) return
      const { type, contentIndex } = update
      const now = Date.now()
      // Some providers end every block only when the stream does, so a later block ends thinking too.
      startedAt.forEach((start, index) => {
        if (index < contentIndex || (index === contentIndex && type === 'thinking_end')) {
          durations[index] ??= now - start
        }
      })
      if (type === 'thinking_start') startedAt[contentIndex] = now
    })

    pi.on('message_end', (event) => {
      if (event.message.role !== 'assistant') return
      // An aborted reply never ends its last thinking block.
      startedAt.forEach((start, index) => {
        durations[index] ??= Date.now() - start
      })
      return { message: stamp(event.message) }
    })
  }

  return { extension, stamp }
}
