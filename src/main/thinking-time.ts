import type { ExtensionFactory, MessageEndEvent } from '@earendil-works/pi-coding-agent'

type AgentMessage = MessageEndEvent['message']

/**
 * A block that starts and ends closer together than this was buffered upstream and arrived in one
 * burst; its thinking happened before it reached us, so the gap is not its time.
 */
const MIN_MEASURABLE_MS = 100

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
  /** Per `contentIndex` of the streaming reply; a block's start is cleared once it ends. */
  let startedAt: (number | undefined)[] = []
  let durations: number[] = []

  const end = (index: number, now: number) => {
    const start = startedAt[index]
    if (start == null) return
    startedAt[index] = undefined
    if (now - start >= MIN_MEASURABLE_MS) durations[index] = now - start
  }

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
      startedAt.forEach((_, index) => {
        if (index < contentIndex || (index === contentIndex && type === 'thinking_end')) {
          end(index, now)
        }
      })
      if (type === 'thinking_start') startedAt[contentIndex] = now
    })

    pi.on('message_end', (event) => {
      if (event.message.role !== 'assistant') return
      // An aborted reply never ends its last thinking block.
      const now = Date.now()
      startedAt.forEach((_, index) => end(index, now))
      return { message: stamp(event.message) }
    })
  }

  return { extension, stamp }
}
