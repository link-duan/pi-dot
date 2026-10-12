import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { reviewComments } from '@/session/state'
import { useSession } from '@/session/store'
import { PromptEditorField, PromptSubmitPlugin, promptEditorConfig } from './composer/PromptEditor'
import { serializeEditorState } from './composer/serialize'

const feedbackConfig = promptEditorConfig('pi-plan-feedback')

/** Capsule button: a popover for an overall note, sent together with the inline comments. */
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
            size="icon"
            className="relative rounded-full text-muted-foreground"
            aria-label="Add feedback"
            title="Add feedback"
          />
        }
      >
        <MessageSquarePlus />
        {count > 0 ? (
          <span className="absolute top-0 right-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-plan px-0.5 text-[9px] leading-none font-medium text-background">
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
        <LexicalComposer initialConfig={feedbackConfig}>
          <FeedbackForm onSent={() => setOpen(false)} />
        </LexicalComposer>
      </PopoverContent>
    </Popover>
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
          placeholder="Add feedback on the plan…"
          className="block max-h-80 min-h-[calc(5lh+0.75rem)] w-full overflow-y-auto px-1.5 py-1.5 leading-relaxed text-foreground outline-none"
          onChange={setNote}
        />
      </div>
      <div className="flex items-center justify-between gap-2 pl-1.5">
        <span className="text-xs text-muted-foreground">
          {count === 0 ? 'No inline comments' : `${count} inline comment${count === 1 ? '' : 's'}`}
        </span>
        <Button type="button" size="sm" disabled={!canSend} onClick={submit}>
          Send feedback
        </Button>
      </div>
      <PromptSubmitPlugin onSubmit={submit} />
    </>
  )
}
