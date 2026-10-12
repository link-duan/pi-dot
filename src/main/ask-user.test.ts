import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { describe, expect, it } from 'vitest'
import type { AskQuestion } from '@shared/protocol'
import { createAskUser, formatReply } from './ask-user'

const questions: AskQuestion[] = [
  { question: 'Which platforms?', options: [{ label: 'macOS' }, { label: 'Windows' }] },
  { question: 'How to test?', options: [{ label: 'Unit' }, { label: 'E2E' }], multiSelect: true },
]

describe('formatReply', () => {
  it('pairs each question with its picks and own answer', () => {
    expect(
      formatReply(questions, {
        kind: 'answers',
        answers: [{ selected: ['macOS'] }, { selected: ['Unit', 'E2E'], other: 'manual too' }],
      }),
    ).toBe('"Which platforms?" → macOS\n"How to test?" → Unit, E2E, (other) manual too')
  })

  it('passes a Composer reply and a skip through', () => {
    expect(formatReply(questions, { kind: 'message', text: 'just macOS' })).toContain('just macOS')
    expect(formatReply(questions, { kind: 'skipped' })).toContain('skipped')
  })
})

type Tool = {
  execute: (
    id: string,
    params: { questions: AskQuestion[] },
    signal?: AbortSignal,
  ) => Promise<{ content: { text: string }[]; details: unknown }>
}

function setup() {
  let tool: Tool | undefined
  let active = ['read']
  const handlers: Record<string, () => void> = {}
  const askUser = createAskUser()
  void askUser.extension({
    registerTool: (definition: Tool) => {
      tool = definition
    },
    on: (name: string, handler: () => void) => {
      handlers[name] = handler
    },
    getActiveTools: () => active,
    setActiveTools: (names: string[]) => {
      active = names
    },
  } as unknown as ExtensionAPI)
  return { askUser, tool: tool!, handlers, activeTools: () => active }
}

describe('createAskUser', () => {
  it('waits for the answer to the call', async () => {
    const { askUser, tool } = setup()
    const run = tool.execute('call-1', { questions })
    expect(askUser.answer('other', { kind: 'skipped' })).toBe(false)
    expect(askUser.answer('call-1', { kind: 'message', text: 'hi' })).toBe(true)
    const result = await run
    expect(result.content[0]?.text).toContain('hi')
    expect(result.details).toEqual({ questions, reply: { kind: 'message', text: 'hi' } })
    expect(askUser.answer('call-1', { kind: 'message', text: 'again' })).toBe(false)
  })

  it('rejects and forgets the call when the run is aborted', async () => {
    const { askUser, tool } = setup()
    const controller = new AbortController()
    const run = tool.execute('call-1', { questions }, controller.signal)
    controller.abort()
    await expect(run).rejects.toThrow('dismissed')
    expect(askUser.answer('call-1', { kind: 'skipped' })).toBe(false)
  })

  it('keeps the tool active in a resumed session', () => {
    const { handlers, activeTools } = setup()
    handlers.session_start?.()
    expect(activeTools()).toEqual(['read', 'ask_user'])
  })
})
