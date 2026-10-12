import { ArrowUp, Folder, ListChecks, Square, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  $createParagraphNode,
  $createTextNode,
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
import { displayPath } from '@/lib/path'
import { cn } from '@/lib/utils'
import { useChat, useSession } from '@/session/store'
import { FollowUpQueue } from './FollowUpQueue'
import { ComposerActions } from './ComposerActions'
import { PlanReview } from './PlanReview'
import { activateSession, draftText, rememberDraft } from './composer/drafts'
import { $clearEditor, PromptEditorField, promptEditorConfig } from './composer/PromptEditor'
import { serializeEditorState } from './composer/serialize'
import { ContextUsageRing } from './ContextUsageRing'
import { ModelSelect } from './ModelSelect'

const initialConfig = promptEditorConfig('pi-composer')

export function Composer({ onSend }: { onSend?: () => void } = {}) {
  return (
    <LexicalComposer initialConfig={initialConfig}>
      <ComposerForm onSend={onSend} />
    </LexicalComposer>
  )
}

function ComposerForm({ onSend }: { onSend?: () => void }) {
  const [editor] = useLexicalComposerContext()
  const [draft, setDraft] = useState(() => draftText(useSession.getState().sessionFile))
  const sessionRef = useRef<string | null | undefined>(undefined)
  const focusNonce = useSession((state) => state.focusNonce)
  const focusAtMount = useRef(focusNonce)
  const cwd = useSession((state) => state.cwd)
  const connection = useSession((state) => state.connection)
  const send = useSession((state) => state.send)
  const steer = useSession((state) => state.steer)
  const followUp = useSession((state) => state.followUp)
  const abort = useSession((state) => state.abort)
  const openFolder = useSession((state) => state.openFolder)
  const isStreaming = useChat((state) => state.isStreaming)
  const planMode = useChat((state) => state.planMode)
  const setPlanMode = useSession((state) => state.setPlanMode)
  const togglePlanMode = useCallback(() => setPlanMode(!planMode), [planMode, setPlanMode])
  const runCommand = useCallback(
    (name: string) => {
      if (name === 'plan') setPlanMode(true)
    },
    [setPlanMode],
  )
  const hasDraft = draft.trim().length > 0
  const placeholder = planMode ? 'Describe what to plan...' : 'Message...'
  const canSend = connection === 'ready' && hasDraft

  const submit = useCallback(
    async (mode?: 'steer' | 'followUp') => {
      const next = serializeEditorState(editor.getEditorState()).trim()
      if (!next || connection !== 'ready') return
      try {
        if (isStreaming) {
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
    [connection, editor, followUp, isStreaming, onSend, send, steer],
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
      editor.update(() => {
        const root = $getRoot()
        root.clear()
        const lines = text.split('\n')
        for (const line of lines) {
          const paragraph = $createParagraphNode()
          if (line) {
            paragraph.append($createTextNode(line))
          }
          root.append(paragraph)
        }
        const lastChild = root.getLastChild()
        if (lastChild) {
          lastChild.selectEnd()
        }
      })
      editor.focus()
    },
    [editor],
  )

  return (
    <div className="pointer-events-none relative z-10 -mt-6 shrink-0 px-4 pt-1 pb-3">
      <div className="pointer-events-auto mx-auto max-w-3xl">
        <FollowUpQueue onEdit={handleEditFollowUp} canEdit={() => !hasDraft} />
        <PlanReview />
        <ComposerActions />
      </div>

      <form
        className={cn(
          'pointer-events-auto relative mx-auto max-w-3xl rounded-2xl border bg-card/90 px-1.5 pt-1 pb-1 backdrop-blur-md dark:bg-card/95',
          planMode ? 'border-plan/50' : 'border-border',
        )}
        onSubmit={(event) => {
          event.preventDefault()
          submit(isStreaming ? 'steer' : undefined)
        }}
      >
        <label className="sr-only" htmlFor="prompt-input">
          Prompt
        </label>
        <PromptEditorField
          id="prompt-input"
          placeholder={placeholder}
          className="composer-editor block max-h-[calc(8.5lh+0.5rem)] min-h-[calc(1lh+0.75rem)] w-full scroll-fade overflow-y-auto px-1.5 py-1.5 leading-relaxed text-foreground outline-none"
          onChange={(text, state) => {
            setDraft(text)
            rememberDraft(sessionRef.current ?? null, state)
          }}
          onCommand={runCommand}
        />
        <ComposerKeyPlugin
          isStreaming={isStreaming}
          onSubmit={submit}
          onTogglePlanMode={togglePlanMode}
        />

        <div className="flex items-center justify-between gap-2 px-0.5 text-xs">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {planMode ? (
              <span
                className="-ml-0.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-[calc(var(--radius-2xl)-7px)] bg-plan/10 pr-0.5 pl-1.5 text-xs font-medium text-plan"
                title={`Plan mode · Shift+Tab to exit${isStreaming ? ' · applies to the next message' : ''}`}
              >
                <ListChecks className="size-3" />
                Plan
                <button
                  type="button"
                  aria-label="Exit plan mode"
                  onClick={() => setPlanMode(false)}
                  className="flex size-4 cursor-pointer items-center justify-center rounded-sm hover:bg-plan/15"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}
            {cwd ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => void openFolder()}
                      className="max-w-full min-w-0 text-xs text-muted-foreground"
                    />
                  }
                >
                  <Folder className="size-3 shrink-0" />
                  <span className="truncate">{displayPath(cwd, null, window.pi.homedir)}</span>
                </TooltipTrigger>
                <TooltipContent>{`Current folder: ${cwd} (click to change)`}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <ContextUsageRing />
            <ModelSelect />

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
                      aria-label={isStreaming ? 'Steer' : 'Send'}
                    />
                  }
                >
                  <ArrowUp className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>
                  {isStreaming ? 'Steer · ⌥Enter for follow-up' : 'Send'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

function ComposerKeyPlugin({
  isStreaming,
  onSubmit,
  onTogglePlanMode,
}: {
  isStreaming: boolean
  onSubmit: (mode?: 'steer' | 'followUp') => void
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
          if (isStreaming) {
            event?.preventDefault()
            onSubmit('followUp')
            return true
          }
          return false
        }
        event?.preventDefault()
        onSubmit(isStreaming ? 'steer' : undefined)
        return true
      },
      COMMAND_PRIORITY_NORMAL,
    )
  }, [editor, isStreaming, onSubmit])

  return null
}
