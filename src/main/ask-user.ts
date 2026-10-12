import { Type } from '@earendil-works/pi-ai'
import type { ExtensionFactory } from '@earendil-works/pi-coding-agent'
import { ASK_USER_TOOL, type AskQuestion, type AskReply } from '@shared/protocol'

const ASK_USER_DESCRIPTION =
  "Ask the user 1–4 multiple-choice questions and wait for their answers. Ask only when the answer changes what you do and the code can't tell you. Put your pick first and end its label with (Recommended). The user can always type their own answer, so never add an 'Other' option."

/** The tool result the model reads. */
export function formatReply(questions: readonly AskQuestion[], reply: AskReply): string {
  switch (reply.kind) {
    case 'skipped':
      return 'The user skipped the questions; proceed with your best judgment.'
    case 'message':
      return `The user replied instead of picking options: ${reply.text}`
    case 'answers':
      return questions
        .map((question, index) => {
          const { selected, other } = reply.answers[index]!
          const parts = other ? [...selected, `(other) ${other}`] : selected
          return `"${question.question}" → ${parts.join(', ')}`
        })
        .join('\n')
  }
}

export interface AskUser {
  extension: ExtensionFactory
  /** Resolves the waiting `ask_user` call; false when no call with that id is waiting. */
  answer(toolCallId: string, reply: AskReply): boolean
}

export function createAskUser(): AskUser {
  const waiting = new Map<string, (reply: AskReply) => void>()

  const extension: ExtensionFactory = (pi) => {
    pi.registerTool({
      name: ASK_USER_TOOL,
      label: 'Ask User',
      description: ASK_USER_DESCRIPTION,
      // Codemode can't call it: the UI only sees calls the model makes directly.
      exposure: 'model-only',
      parameters: Type.Object({
        questions: Type.Array(
          Type.Object({
            question: Type.String({ description: "The full question, in the user's language." }),
            options: Type.Array(
              Type.Object({
                label: Type.String({ description: '1–5 words.' }),
                description: Type.Optional(
                  Type.String({ description: 'What picking it means, its trade-off.' }),
                ),
              }),
              { minItems: 2, maxItems: 4 },
            ),
            multiSelect: Type.Optional(Type.Boolean({ description: 'Allow several picks.' })),
          }),
          { minItems: 1, maxItems: 4 },
        ),
      }),
      async execute(toolCallId, params, signal) {
        const reply = await new Promise<AskReply>((resolve, reject) => {
          const dismiss = () => {
            waiting.delete(toolCallId)
            reject(new Error('The user dismissed the questions.'))
          }
          if (signal?.aborted) return dismiss()
          signal?.addEventListener('abort', dismiss, { once: true })
          waiting.set(toolCallId, (value) => {
            signal?.removeEventListener('abort', dismiss)
            waiting.delete(toolCallId)
            resolve(value)
          })
        })
        return {
          content: [{ type: 'text', text: formatReply(params.questions, reply) }],
          details: { questions: params.questions, reply },
        }
      },
    })

    // pi restores a resumed session's loadout from its transcript, which may predate the tool.
    const restore = () => {
      const tools = pi.getActiveTools()
      if (!tools.includes(ASK_USER_TOOL)) pi.setActiveTools([...tools, ASK_USER_TOOL])
    }
    pi.on('session_start', restore)
    pi.on('session_tree', restore)
  }

  return {
    extension,
    answer(toolCallId, reply) {
      const resolve = waiting.get(toolCallId)
      resolve?.(reply)
      return Boolean(resolve)
    },
  }
}
