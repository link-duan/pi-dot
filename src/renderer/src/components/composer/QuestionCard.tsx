import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { AskAnswer, AskQuestion, AskReply } from '@shared/protocol'
import { Button } from '@/components/ui/button'
import { splitRecommended } from '@/lib/format'
import { cn } from '@/lib/utils'
import { pendingQuestion } from '@/session/state'
import { useSession } from '@/session/store'
import { BUTTON_RADIUS, CARD, ROW } from './card'
import { RowNumber } from './RowNumber'

/** Delay before a single-choice pick turns to the next question, so the pick is seen. */
const ADVANCE_MS = 150

function isAnswered(answer: AskAnswer): boolean {
  return answer.selected.length > 0 || Boolean(answer.other?.trim())
}

/** Above the Composer while an `ask_user` call waits for the user. */
export function QuestionCard() {
  const pending = useSession(useShallow(pendingQuestion))
  if (!pending) return null
  return (
    <QuestionForm
      key={pending.toolCallId}
      toolCallId={pending.toolCallId}
      questions={pending.questions}
    />
  )
}

function QuestionForm({ toolCallId, questions }: { toolCallId: string; questions: AskQuestion[] }) {
  const answerQuestion = useSession((state) => state.answerQuestion)
  const [answers, setAnswers] = useState<AskAnswer[]>(() => questions.map(() => ({ selected: [] })))
  const [page, setPage] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const otherRef = useRef<HTMLInputElement>(null)
  const advanceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const question = questions[page]!
  const answer = answers[page]!
  const multi = Boolean(question.multiSelect)
  const last = page === questions.length - 1
  const otherRow = question.options.length
  const otherText = answer.other ?? ''
  const canContinue = isAnswered(answer) && (!last || answers.every(isAnswered))
  // A lone single-choice question submits on pick; it needs the button only for an own answer.
  const showNext = questions.length > 1 || multi || Boolean(otherText.trim())

  const reply = (value: AskReply) => {
    setSubmitting(true)
    // The card goes away when the tool ends; on failure the store reports the error.
    answerQuestion(toolCallId, value).catch(() => setSubmitting(false))
  }

  const submit = (list: AskAnswer[]) =>
    reply({
      kind: 'answers',
      answers: list.map(({ selected, other }) =>
        other?.trim() ? { selected, other: other.trim() } : { selected },
      ),
    })

  const goTo = (next: number) => {
    clearTimeout(advanceRef.current)
    setPage(next)
    // Rows are reused across pages; focus on one would land on another question's row.
    if (rootRef.current?.contains(document.activeElement)) rootRef.current.focus()
  }

  const update = (next: AskAnswer): AskAnswer[] => {
    const list = answers.map((item, index) => (index === page ? next : item))
    setAnswers(list)
    return list
  }

  const pick = (label: string) => {
    if (submitting) return
    if (multi) {
      const selected = answer.selected.includes(label)
        ? answer.selected.filter((item) => item !== label)
        : [...answer.selected, label]
      update({ ...answer, selected })
      return
    }
    const list = update({ selected: [label] })
    if (questions.length === 1) submit(list)
    else if (!last) advanceRef.current = setTimeout(() => goTo(page + 1), ADVANCE_MS)
  }

  const setOther = (other: string) =>
    update(multi || !other.trim() ? { ...answer, other } : { selected: [], other })

  const next = () => {
    if (submitting || !canContinue) return
    if (last) submit(answers)
    else goTo(page + 1)
  }

  // Rows are native buttons: Tab, Space and Enter work as usual; this adds number keys, arrows
  // between rows and questions, and ⌘⏎ (or Enter in Other) for Next / Submit.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing || submitting) return
    const inOther = event.target === otherRef.current
    if (event.key === 'Enter' && (event.metaKey || inOther)) {
      event.preventDefault()
      next()
      return
    }
    if (inOther || event.metaKey || event.ctrlKey || event.altKey) return
    const rows = [...rootRef.current!.querySelectorAll<HTMLElement>('[data-row]')]
    const at = rows.indexOf(document.activeElement as HTMLElement)
    const digit = Number(event.key)
    if (Number.isInteger(digit) && digit >= 1 && digit <= rows.length) {
      if (digit - 1 === otherRow) otherRef.current?.focus()
      else pick(question.options[digit - 1]!.label)
    } else if (event.key === 'ArrowDown') rows[(at + 1) % rows.length]?.focus()
    else if (event.key === 'ArrowUp') rows[at <= 0 ? rows.length - 1 : at - 1]?.focus()
    else if (event.key === 'ArrowRight' && !last) goTo(page + 1)
    else if (event.key === 'ArrowLeft' && page > 0) goTo(page - 1)
    else return
    event.preventDefault()
  }

  useEffect(() => {
    // Take focus for number keys, unless the user is typing something.
    const active = document.activeElement as HTMLElement | null
    if (active === document.body || (active?.isContentEditable && !active.textContent?.trim())) {
      rootRef.current?.focus()
    }
    return () => clearTimeout(advanceRef.current)
  }, [])

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      aria-label="Questions from the agent"
      onKeyDown={onKeyDown}
      className={CARD}
    >
      <div className="flex items-baseline gap-2 px-2 pt-1 pb-1.5">
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
          {question.question}
          {multi ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">Select any</span>
          ) : null}
        </p>
        {questions.length > 1 ? (
          <div className="-my-1 flex shrink-0 items-center self-center text-xs text-muted-foreground tabular-nums">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Previous question"
              disabled={page === 0}
              onClick={() => goTo(page - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="px-0.5">
              {page + 1}/{questions.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Next question"
              disabled={last}
              onClick={() => goTo(page + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </div>

      <div role={multi ? 'group' : 'radiogroup'} aria-label={question.question}>
        {question.options.map((option, index) => {
          const selected = answer.selected.includes(option.label)
          const { text, recommended } = splitRecommended(option.label)
          return (
            <button
              key={option.label}
              type="button"
              data-row
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={selected}
              disabled={submitting}
              onClick={() => pick(option.label)}
              className={cn(
                ROW,
                'focus-visible:bg-muted/50',
                selected && 'bg-muted hover:bg-muted focus-visible:bg-muted',
              )}
            >
              <RowNumber value={index + 1} />
              <span className="shrink-0 text-foreground">{text}</span>
              {recommended ? (
                <span className="shrink-0 self-center rounded-full border border-border px-1.5 text-[11px] leading-4 text-muted-foreground">
                  Recommended
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {option.description}
              </span>
              <Check className={cn('size-3.5 shrink-0 self-center', !selected && 'invisible')} />
            </button>
          )
        })}
        <label
          className={cn(
            ROW,
            'cursor-text has-focus-visible:bg-muted/50',
            otherText.trim() && 'bg-muted hover:bg-muted has-focus-visible:bg-muted',
          )}
        >
          <RowNumber value={otherRow + 1} />
          <input
            ref={otherRef}
            data-row
            value={otherText}
            disabled={submitting}
            placeholder="Other…"
            onChange={(event) => setOther(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Check
            className={cn('size-3.5 shrink-0 self-center', !otherText.trim() && 'invisible')}
          />
        </label>
      </div>

      <div className="mt-1 flex justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('text-muted-foreground', BUTTON_RADIUS)}
          disabled={submitting}
          onClick={() => reply({ kind: 'skipped' })}
        >
          Skip
        </Button>
        {showNext ? (
          <Button
            type="button"
            size="sm"
            className={BUTTON_RADIUS}
            disabled={submitting || !canContinue}
            onClick={next}
          >
            {last ? 'Submit' : 'Next'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
