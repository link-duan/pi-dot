import { ArrowUp, Square } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ChatState } from '@/chat/state'
import { cn } from '@/lib/utils'
import { pendingQuestion } from '@/session/state'
import { useChat, useSession } from '@/session/store'
import { FollowUpQueue } from './FollowUpQueue'
import { LoopBadge } from '@/components/loop/LoopBadge'
import { LoopCard } from '@/components/loop/LoopCard'
import { ComposerActions } from './ComposerActions'
import { CARD } from './card'
import { PlanReview } from '@/components/plan/PlanReview'
import { QuestionCard } from './QuestionCard'
import { activateSession, draftText, rememberDraft } from '@/components/composer/editor/drafts'
import { $clearEditor, promptEditorConfig } from '@/components/composer/editor/prompt-editor'
import { serializeEditorState } from '@/components/composer/editor/serialize'
import { $setComposerText } from '@/components/composer/editor/set-text'
import { ContextUsageRing } from './ContextUsageRing'
import { ExtensionWidgets } from '@/components/extension/ExtensionWidgets'
import { ExtensionStatuses } from '@/components/extension/ExtensionStatuses'
import { ExtensionDialogCard } from './ExtensionDialogCard'
import { ModelSelect } from '@/components/pickers/ModelSelect'
import { ComposerCard } from './ComposerCard'
import { PlanBadge } from '@/components/plan/PlanBadge'

const initialConfig = promptEditorConfig('pi-composer')

/**
 * What sending does: reply to a waiting question, change the loop's prompt, start a loop, steer
 * the run, or start one.
 */
type SendAction =
  | { kind: 'reply'; questionId: string }
  | { kind: 'editLoop' }
  | { kind: 'startLoop'; ms: number | null }
  | { kind: 'steer' }
  | { kind: 'send' }

function sendAction(
  questionId: string | null,
  loopDraft: ChatState['loopDraft'],
  isStreaming: boolean,
): SendAction {
  // A waiting question blocks the run, so a steer would only land after it is answered.
  if (questionId) return { kind: 'reply', questionId }
  if (loopDraft?.kind === 'edit') return { kind: 'editLoop' }
  if (loopDraft) return { kind: 'startLoop', ms: loopDraft.ms }
  return { kind: isStreaming ? 'steer' : 'send' }
}

/** Without its own placeholder, an action shows the message one. */
const SEND: Record<SendAction['kind'], { label: string; tooltip: string; placeholder?: string }> = {
  reply: {
    label: 'Reply',
    tooltip: 'Reply to the questions',
    placeholder: 'Or type a reply to all questions...',
  },
  editLoop: {
    label: 'Save loop prompt',
    tooltip: 'Change the loop prompt',
    placeholder: 'Edit the loop prompt...',
  },
  startLoop: {
    label: 'Start loop',
    tooltip: 'Start the loop',
    placeholder: 'Describe what to repeat...',
  },
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
  const loopDraft = useChat((state) => state.loopDraft)
  const setLoopDraft = useSession((state) => state.setLoopDraft)
  const setLoop = useSession((state) => state.setLoop)
  const editLoop = useSession((state) => state.editLoop)
  const compact = useSession((state) => state.compact)
  const newSession = useSession((state) => state.newSession)
  const noModels = useSession((state) => state.connection === 'ready' && state.models.length === 0)
  const runCommand = useCallback(
    (name: string) => {
      if (name === 'plan') setPlanMode(true)
      if (name === 'loop') setLoopDraft({ kind: 'start', ms: null })
      if (name === 'compact') void compact()
      if (name === 'new') void newSession()
    },
    [compact, newSession, setLoopDraft, setPlanMode],
  )
  const hasDraft = draft.trim().length > 0
  const action = useMemo(
    () => sendAction(questionId, loopDraft, isStreaming),
    [isStreaming, loopDraft, questionId],
  )
  const placeholder = noModels
    ? 'Connect a provider to start…'
    : (SEND[action.kind].placeholder ?? (planMode ? 'Describe what to plan...' : 'Message...'))
  const canSend = connection === 'ready' && hasDraft && !noModels

  const submit = useCallback(
    async (next: string, mode?: 'followUp') => {
      if (connection !== 'ready') return
      try {
        switch (action.kind) {
          case 'reply':
            await answerQuestion(action.questionId, { kind: 'message', text: next })
            break
          case 'editLoop':
            await editLoop(next)
            setLoopDraft(null)
            break
          case 'startLoop':
            await setLoop({ prompt: next, ms: action.ms })
            setLoopDraft(null)
            break
          case 'steer':
            try {
              await (mode === 'followUp' ? followUp(next) : steer(next))
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              if (!message.includes('Session is not streaming')) throw error
              await send(next)
            }
            break
          case 'send':
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
    [
      action,
      answerQuestion,
      connection,
      editLoop,
      editor,
      followUp,
      onSend,
      send,
      setLoop,
      setLoopDraft,
      steer,
    ],
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

  const fillComposer = useCallback(
    (text: string) => {
      editor.update(() => $setComposerText(text))
      editor.focus()
    },
    [editor],
  )

  const exitLoopDraft = useCallback(() => {
    // Leaving an edit drops the prompt it loaded; a new loop keeps what was typed.
    if (loopDraft?.kind === 'edit') {
      editor.update($clearEditor, { discrete: true })
      setDraft('')
    }
    setLoopDraft(null)
  }, [editor, loopDraft, setLoopDraft])

  // Text main or the store hands over: a forked message, or an extension's setEditorText.
  const composerFill = useSession((state) => state.composerFill)
  useEffect(() => {
    if (!composerFill) return
    fillComposer(composerFill.text)
    // Taken once; a remounted Composer must not fill it again.
    useSession.setState({ composerFill: null })
  }, [composerFill, fillComposer])

  return (
    <div className="pointer-events-none relative z-10 -mt-6 shrink-0 px-4 pt-1 pb-3">
      <div className="pointer-events-auto mx-auto max-w-3xl">
        <FollowUpQueue onEdit={fillComposer} canEdit={() => !hasDraft} />
        <QuestionCard />
        <ExtensionDialogCard />
        <PlanReview />
        <LoopCard
          canEdit={!hasDraft}
          onEdit={(prompt) => {
            setLoopDraft({ kind: 'edit' })
            fillComposer(prompt)
          }}
        />
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
          <div className="flex min-w-0 flex-1 items-center gap-0.5">
            {planMode ? <PlanBadge onExit={() => setPlanMode(false)} /> : null}
            <LoopBadge onExit={exitLoopDraft} />
            <ModelSelect className="first:-ml-1" />
            <ContextUsageRing />
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
                      aria-label={SEND[action.kind].label}
                    />
                  }
                >
                  <ArrowUp className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>{SEND[action.kind].tooltip}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </ComposerCard>
    </div>
  )
}
