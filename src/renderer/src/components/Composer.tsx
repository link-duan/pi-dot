import { ArrowUp, ListChecks, Square, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import {
  $getRoot,
  COMMAND_PRIORITY_NORMAL,
  INSERT_LINE_BREAK_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { pendingQuestion } from '@/session/state'
import { useChat, useSession } from '@/session/store'
import { FollowUpQueue } from './FollowUpQueue'
import { ComposerActions } from './ComposerActions'
import { CARD } from './composer-card'
import { PlanReview } from './PlanReview'
import { QuestionCard } from './QuestionCard'
import { activateSession, draftText, rememberDraft } from './composer/drafts'
import { $clearEditor, PromptEditorField, promptEditorConfig } from './composer/PromptEditor'
import { serializeEditorState } from './composer/serialize'
import { $setComposerText } from './composer/set-text'
import { ContextUsageRing } from './ContextUsageRing'
import { ExtensionStatuses, ExtensionWidgets } from './ExtensionChrome'
import { ExtensionDialogCard } from './ExtensionDialogCard'
import { ModelSelect } from './ModelSelect'

const initialConfig = promptEditorConfig('pi-composer')

/** What sending does: reply to a waiting question, steer the run, or start one. */
type SendAction = 'reply' | 'steer' | 'send'

const SEND_LABELS: Record<SendAction, { label: string; tooltip: string }> = {
  reply: { label: 'Reply', tooltip: 'Reply to the questions' },
  steer: { label: 'Steer', tooltip: 'Steer · ⌥Enter for follow-up' },
  send: { label: 'Send', tooltip: 'Send' },
}

export function Composer({ onSend }: { onSend?: () => void } = {}) {
  return (
    <LexicalComposer initialConfig={initialConfig}>
      <SessionComposer onSend={onSend} />
    </LexicalComposer>
  )
}

function SessionComposer({ onSend }: { onSend?: () => void }) {
  const [editor] = useLexicalComposerContext()
  const [draft, setDraft] = useState(() => draftText(useSession.getState().sessionFile))
  const sessionRef = useRef<string | null | undefined>(undefined)
  const focusNonce = useSession((state) => state.focusNonce)
  const focusAtMount = useRef(focusNonce)
  const connection = useSession((state) => state.connection)
  const send = useSession((state) => state.send)
  const steer = useSession((state) => state.steer)
  const followUp = useSession((state) => state.followUp)
  const answerQuestion = useSession((state) => state.answerQuestion)
  const questionId = useSession((state) => pendingQuestion(state)?.toolCallId ?? null)
  const abort = useSession((state) => state.abort)
  const isStreaming = useChat((state) => state.isStreaming)
  const planMode = useChat((state) => state.planMode)
  const setPlanMode = useSession((state) => state.setPlanMode)
  const compact = useSession((state) => state.compact)
  const newSession = useSession((state) => state.newSession)
  const noModels = useSession((state) => state.connection === 'ready' && state.models.length === 0)
  const runCommand = useCallback(
    (name: string) => {
      if (name === 'plan') setPlanMode(true)
      if (name === 'compact') void compact()
      if (name === 'new') void newSession()
    },
    [compact, newSession, setPlanMode],
  )
  const hasDraft = draft.trim().length > 0
  const action: SendAction = questionId ? 'reply' : isStreaming ? 'steer' : 'send'
  const placeholder = noModels
    ? 'Connect a provider to start…'
    : questionId
      ? 'Or type a reply to all questions...'
      : planMode
        ? 'Describe what to plan...'
        : 'Message...'
  const canSend = connection === 'ready' && hasDraft && !noModels

  const submit = useCallback(
    async (next: string, mode?: 'followUp') => {
      if (connection !== 'ready') return
      try {
        // A waiting question blocks the run, so a steer would only land after it is answered.
        if (questionId) {
          await answerQuestion(questionId, { kind: 'message', text: next })
        } else if (isStreaming) {
          try {
            if (mode === 'followUp') {
              await followUp(next)
            } else {
              await steer(next)
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (!message.includes('Session is not streaming')) throw error
            await send(next)
          }
        } else {
          await send(next)
        }
      } catch (error) {
        console.error('Failed to submit prompt', error)
        return
      }
      editor.update($clearEditor, { discrete: true })
      setDraft('')
      onSend?.()
    },
    [answerQuestion, connection, editor, followUp, isStreaming, onSend, questionId, send, steer],
  )

  useLayoutEffect(() => {
    if (focusNonce === focusAtMount.current) return
    editor.focus()
  }, [editor, focusNonce])

  useLayoutEffect(() => {
    const initial = useSession.getState().sessionFile
    sessionRef.current = initial
    let unbind = activateSession(editor, null, initial)

    const stop = useSession.subscribe((state, prev) => {
      if (state.sessionFile === prev.sessionFile) return
      unbind()
      const from = sessionRef.current ?? null
      sessionRef.current = state.sessionFile
      unbind = activateSession(editor, from, state.sessionFile)
      setDraft(serializeEditorState(editor.getEditorState()))
    })
    return () => {
      stop()
      unbind()
    }
  }, [editor])

  const handleEditFollowUp = useCallback(
    (text: string) => {
      editor.update(() => $setComposerText(text))
      editor.focus()
    },
    [editor],
  )

  // Text main or the store hands over: a forked message, or an extension's setEditorText.
  const composerFill = useSession((state) => state.composerFill)
  useEffect(() => {
    if (!composerFill) return
    handleEditFollowUp(composerFill.text)
    // Taken once; a remounted Composer must not fill it again.
    useSession.setState({ composerFill: null })
  }, [composerFill, handleEditFollowUp])

  return (
    <div className="pointer-events-none relative z-10 -mt-6 shrink-0 px-4 pt-1 pb-3">
      <div className="pointer-events-auto mx-auto max-w-3xl">
        <FollowUpQueue onEdit={handleEditFollowUp} canEdit={() => !hasDraft} />
        <QuestionCard />
        <ExtensionDialogCard />
        <PlanReview />
        <ComposerActions />
        <ExtensionWidgets placement="aboveEditor" className={cn(CARD, 'px-3 py-2')} />
      </div>

      <label className="sr-only" htmlFor="prompt-input">
        Prompt
      </label>
      <ComposerCard
        id="prompt-input"
        scope="session"
        placeholder={placeholder}
        planMode={planMode}
        onPlanModeChange={setPlanMode}
        onChange={(text, state) => {
          setDraft(text)
          rememberDraft(sessionRef.current ?? null, state)
        }}
        onCommand={runCommand}
        onSubmit={(text) => void submit(text)}
        onFollowUp={isStreaming ? (text) => void submit(text, 'followUp') : undefined}
      >
        <ExtensionWidgets
          placement="belowEditor"
          className="border-t border-border/60 px-1.5 pt-1.5 pb-1"
        />

        <div className="flex items-center justify-between gap-2 px-0.5 text-xs">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <ContextUsageRing />
            <ModelSelect />
            {planMode ? <PlanBadge onExit={() => setPlanMode(false)} /> : null}
            <ExtensionStatuses />
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {isStreaming && !hasDraft ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      size="icon-sm"
                      className="-mr-1 rounded-[calc(var(--radius-2xl)-5px)]"
                      aria-label="Stop"
                      onClick={() =>
                        void abort().catch((error: unknown) => {
                          console.error('Failed to abort session', error)
                        })
                      }
                    />
                  }
                >
                  <Square className="size-2.5 fill-current" />
                </TooltipTrigger>
                <TooltipContent>Stop</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="submit"
                      size="icon-sm"
                      className="-mr-1 rounded-[calc(var(--radius-2xl)-5px)] transition-opacity"
                      disabled={!canSend}
                      aria-label={SEND_LABELS[action].label}
                    />
                  }
                >
                  <ArrowUp className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>{SEND_LABELS[action].tooltip}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </ComposerCard>
    </div>
  )
}

/**
 * The prompt box: the editor, its keys and its Plan Mode border, inside a `LexicalComposer`.
 * Submitting hands over the trimmed text; what goes below the editor is `children`.
 */
export function ComposerCard({
  planMode,
  onPlanModeChange,
  onSubmit,
  onFollowUp,
  onEscape,
  autoFocus,
  children,
  ...field
}: Pick<
  ComponentProps<typeof PromptEditorField>,
  'id' | 'scope' | 'placeholder' | 'onChange' | 'onCommand'
> & {
  planMode: boolean
  onPlanModeChange: (on: boolean) => void
  onSubmit: (text: string) => void
  /** Alt+Enter, e.g. queueing a follow-up while the run streams. */
  onFollowUp?: (text: string) => void
  onEscape?: () => void
  /** Focuses the editor once mounted, with the caret at the end. */
  autoFocus?: boolean
  children: ReactNode
}) {
  const [editor] = useLexicalComposerContext()
  const take = useCallback(
    (handler: (text: string) => void) => {
      const text = serializeEditorState(editor.getEditorState()).trim()
      if (text) handler(text)
    },
    [editor],
  )

  useEffect(() => {
    if (!autoFocus) return
    // An initial editor state drops its selection, so the caret goes to the end here.
    editor.update(() => $getRoot().selectEnd())
    editor.focus()
  }, [autoFocus, editor])

  return (
    <form
      className={cn(
        'pointer-events-auto relative mx-auto max-w-3xl rounded-2xl border bg-card/90 px-1.5 pt-1 pb-1 backdrop-blur-md dark:bg-card/95',
        planMode ? 'border-plan/50' : 'border-border',
      )}
      onSubmit={(event) => {
        event.preventDefault()
        take(onSubmit)
      }}
      onKeyDown={(event) => {
        if (!onEscape || event.key !== 'Escape' || event.defaultPrevented) return
        event.preventDefault()
        onEscape()
      }}
    >
      <PromptEditorField
        {...field}
        className="composer-editor block max-h-[calc(8.5lh+0.5rem)] min-h-[calc(1lh+0.75rem)] w-full scroll-fade overflow-y-auto px-1.5 py-1.5 leading-relaxed text-foreground outline-none"
      />
      <ComposerKeyPlugin
        onSubmit={() => take(onSubmit)}
        onFollowUp={onFollowUp ? () => take(onFollowUp) : undefined}
        onTogglePlanMode={() => onPlanModeChange(!planMode)}
      />
      {children}
    </form>
  )
}

export function PlanBadge({ onExit }: { onExit: () => void }) {
  const isStreaming = useChat((state) => state.isStreaming)
  return (
    <span
      className="-ml-0.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-[calc(var(--radius-2xl)-7px)] bg-plan/10 pr-0.5 pl-1.5 text-xs font-medium text-plan"
      title={`Plan mode · Shift+Tab to exit${isStreaming ? ' · applies to the next message' : ''}`}
    >
      <ListChecks className="size-3" />
      Plan
      <button
        type="button"
        aria-label="Exit plan mode"
        onClick={onExit}
        className="flex size-4 cursor-pointer items-center justify-center rounded-sm hover:bg-plan/15"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

function ComposerKeyPlugin({
  onSubmit,
  onFollowUp,
  onTogglePlanMode,
}: {
  onSubmit: () => void
  onFollowUp?: () => void
  onTogglePlanMode: () => void
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        if (!event?.shiftKey) return false
        event.preventDefault()
        onTogglePlanMode()
        return true
      },
      COMMAND_PRIORITY_NORMAL,
    )
  }, [editor, onTogglePlanMode])

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event?.shiftKey) {
          event.preventDefault()
          editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false)
          return true
        }
        if (event?.altKey) {
          if (!onFollowUp) return false
          event.preventDefault()
          onFollowUp()
          return true
        }
        event?.preventDefault()
        onSubmit()
        return true
      },
      COMMAND_PRIORITY_NORMAL,
    )
  }, [editor, onFollowUp, onSubmit])

  return null
}
