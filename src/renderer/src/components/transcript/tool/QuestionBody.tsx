import type { AskQuestion, AskReply } from '@shared/protocol'
import { splitRecommended } from '@/lib/format'

/** An answered `ask_user` call: one line per question with what the user picked. */
export function QuestionBody({
  questions,
  reply,
}: {
  questions: AskQuestion[]
  reply: Exclude<AskReply, { kind: 'skipped' }>
}) {
  if (reply.kind === 'message') {
    return (
      <p className="mt-2 text-xs leading-relaxed whitespace-pre-wrap text-foreground">
        {reply.text}
      </p>
    )
  }
  return (
    <dl className="mt-2 flex flex-col gap-2 text-xs leading-relaxed">
      {questions.map((question, index) => {
        const { selected, other } = reply.answers[index]!
        const parts = selected.map((label) => splitRecommended(label).text)
        return (
          <div key={index}>
            <dt className="text-muted-foreground">{question.question}</dt>
            <dd className="text-foreground">{(other ? [...parts, other] : parts).join(', ')}</dd>
          </div>
        )
      })}
    </dl>
  )
}
