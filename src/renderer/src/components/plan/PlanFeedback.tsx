import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { PlanComment } from '@/lib/plan-feedback'
import { reviewComments } from '@/session/state'
import { useSession } from '@/session/store'
import { editPlanComment, Quote } from './PlanComments'
import { PromptEditorField } from '@/components/composer/editor/PromptEditorField'
import { promptEditorConfig } from '@/components/composer/editor/prompt-editor'
import { PromptSubmitPlugin } from '@/components/composer/editor/PromptSubmitPlugin'
import { serializeEditorState } from '@/components/composer/editor/serialize'

const feedbackConfig = promptEditorConfig('pi-plan-feedback')

/** Revise: a popover listing the inline comments, sent with an optional overall note. */
export function PlanFeedbackButton() {
  const [open, setOpen] = useState(false)
  const count = useSession((state) => reviewComments(state).length)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="rounded-full"
            aria-label="Revise plan"
            title="Revise plan"
          />
        }
      >
        Revise
        {count > 0 ? (
          <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={10}
        className="w-[32rem] max-w-[calc(100vw-2rem)] p-2"
        data-plan-comment=""
      >
        <CommentList onPick={() => setOpen(false)} />
        <LexicalComposer initialConfig={feedbackConfig}>
          <FeedbackForm onSent={() => setOpen(false)} />
        </LexicalComposer>
      </PopoverContent>
    </Popover>
  )
}

/** Picking a comment scrolls to its card, which sits by what it quotes, and opens it for editing. */
function pick(comment: PlanComment): void {
  document.querySelector(`[data-comment-id="${comment.id}"]`)?.scrollIntoView({ block: 'center' })
  editPlanComment(comment)
}

function CommentList({ onPick }: { onPick: () => void }) {
  const comments = useSession(useShallow(reviewComments))
  if (comments.length === 0) return null
  const sorted = [...comments].sort((a, b) => a.start - b.start)
  return (
    <div className="-mx-2 -mt-2 max-h-48 overflow-y-auto border-b border-foreground/5 p-1">
      {sorted.map((comment) => (
        <button
          key={comment.id}
          type="button"
          className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted"
          onClick={() => {
            onPick()
            pick(comment)
          }}
        >
          <Quote text={comment.quote} />
          <div className="mt-0.5 line-clamp-2 text-sm text-foreground">{comment.text}</div>
        </button>
      ))}
    </div>
  )
}

function FeedbackForm({ onSent }: { onSent: () => void }) {
  const [editor] = useLexicalComposerContext()
  const count = useSession((state) => reviewComments(state).length)
  const sendPlanFeedback = useSession((state) => state.sendPlanFeedback)
  const [note, setNote] = useState('')
  const sending = useRef(false)
  const canSend = count > 0 || note.trim().length > 0

  useEffect(() => {
    editor.focus()
  }, [editor])

  const submit = useCallback(() => {
    if (!canSend || sending.current) return
    sending.current = true
    const text = serializeEditorState(editor.getEditorState())
    void sendPlanFeedback(text)
      .then(onSent, (error: unknown) => {
        console.error('Failed to send plan feedback', error)
      })
      .finally(() => {
        sending.current = false
      })
  }, [canSend, editor, onSent, sendPlanFeedback])

  return (
    <>
      <div className="relative">
        <PromptEditorField
          placeholder={count > 0 ? 'Add an overall note (optional)…' : 'Add feedback on the plan…'}
          className="block max-h-80 min-h-[calc(1lh+0.75rem)] w-full overflow-y-auto px-1.5 py-1.5 leading-relaxed text-foreground outline-none"
          onChange={setNote}
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!canSend} onClick={submit}>
          Send feedback
          <Kbd className="bg-transparent px-0 text-primary-foreground/60">⏎</Kbd>
        </Button>
      </div>
      <PromptSubmitPlugin onSubmit={submit} />
    </>
  )
}
