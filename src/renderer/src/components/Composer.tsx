import { ArrowUp, Folder, Square } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  COMMAND_PRIORITY_NORMAL,
  INSERT_LINE_BREAK_COMMAND,
  KEY_ENTER_COMMAND,
} from 'lexical'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import type { FileHit, SkillInfo } from '@shared/protocol'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { displayPath } from '@/lib/path'
import { useChat, useSession } from '@/session/store'
import { FilePicker } from './FilePicker'
import { FollowUpQueue } from './FollowUpQueue'
import { SkillPicker } from './SkillPicker'
import { AtFilePlugin, type FilePickerState } from './composer/AtFilePlugin'
import { ComposerPastePlugin } from './composer/ComposerPastePlugin'
import { FileNode } from './composer/FileNode'
import { $replaceAtQueryWithFile } from './composer/insert-file'
import { $replaceSlashQueryWithSkill } from './composer/insert-skill'
import { SkillNode } from './composer/SkillNode'
import { SlashSkillPlugin, type SkillPickerState } from './composer/SlashSkillPlugin'
import { activateSession, draftText, rememberDraft } from './composer/drafts'
import { serializeEditorState } from './composer/serialize'
import { ContextUsageRing } from './ContextUsageRing'
import { ModelSelect } from './ModelSelect'

const initialConfig = {
  namespace: 'pi-composer',
  onError(error: Error) {
    console.error(error)
  },
  nodes: [SkillNode, FileNode],
  theme: {
    paragraph: 'm-0',
  },
}

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
  const [picker, setPicker] = useState<SkillPickerState | null>(null)
  const [filePicker, setFilePicker] = useState<FilePickerState | null>(null)
  const [fileResults, setFileResults] = useState<{ query: string; hits: FileHit[] }>({
    query: '',
    hits: [],
  })
  const sessionRef = useRef<string | null | undefined>(undefined)
  const focusNonce = useSession((state) => state.focusNonce)
  const focusAtMount = useRef(focusNonce)
  const cwd = useSession((state) => state.cwd)
  const connection = useSession((state) => state.connection)
  const skills = useSession((state) => state.skills)
  const send = useSession((state) => state.send)
  const steer = useSession((state) => state.steer)
  const followUp = useSession((state) => state.followUp)
  const abort = useSession((state) => state.abort)
  const openFolder = useSession((state) => state.openFolder)
  const isStreaming = useChat((state) => state.isStreaming)
  const hasDraft = draft.trim().length > 0
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
      editor.update(
        () => {
          $getRoot().clear()
          $getRoot().append($createParagraphNode())
        },
        { discrete: true },
      )
      setDraft('')
      setPicker(null)
      setFilePicker(null)
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
      setPicker(null)
      setFilePicker(null)
    })
    return () => {
      stop()
      unbind()
    }
  }, [editor])

  const fileQuery = filePicker?.query
  const fileHits = fileQuery == null ? [] : fileResults.hits
  useEffect(() => {
    if (fileQuery == null || !cwd) return
    let cancelled = false
    const timer = setTimeout(() => {
      void window.pi.searchFiles(cwd, fileQuery).then(
        (hits) => {
          if (!cancelled) setFileResults({ query: fileQuery, hits })
        },
        () => {
          if (!cancelled) setFileResults({ query: fileQuery, hits: [] })
        },
      )
    }, 50)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [cwd, fileQuery])

  const insertPicked = useCallback(
    (skill: SkillInfo) => {
      editor.update(() => {
        $replaceSlashQueryWithSkill(skill)
      })
      setPicker(null)
      editor.focus()
    },
    [editor],
  )

  const insertPickedFile = useCallback(
    (hit: FileHit) => {
      editor.update(() => {
        $replaceAtQueryWithFile(hit)
      })
      setFilePicker(null)
      editor.focus()
    },
    [editor],
  )

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
      </div>

      <form
        className="pointer-events-auto relative mx-auto max-w-3xl rounded-2xl border border-border bg-card/90 px-1.5 pt-1 pb-1 shadow-xl shadow-black/5 backdrop-blur-md dark:bg-card/95 dark:shadow-black/50"
        onSubmit={(event) => {
          event.preventDefault()
          submit(isStreaming ? 'steer' : undefined)
        }}
      >
        {filePicker ? (
          <FilePicker
            hits={fileHits}
            index={filePicker.index}
            onHover={(index) => setFilePicker((prev) => (prev ? { ...prev, index } : prev))}
            onSelect={insertPickedFile}
          />
        ) : picker ? (
          <SkillPicker
            skills={skills}
            query={picker.query}
            index={picker.index}
            onHover={(index) => setPicker((prev) => (prev ? { ...prev, index } : prev))}
            onSelect={insertPicked}
          />
        ) : null}

        <label className="sr-only" htmlFor="prompt-input">
          Prompt
        </label>
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                id="prompt-input"
                aria-placeholder="Message..."
                placeholder={
                  <div className="pointer-events-none absolute top-1.5 left-2.5 text-muted-foreground/60 select-none">
                    Message...
                  </div>
                }
                className="composer-editor block max-h-[calc(8.5lh+0.5rem)] min-h-[calc(1lh+0.75rem)] w-full scroll-fade overflow-y-auto px-2.5 py-1.5 leading-relaxed text-foreground outline-none"
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <OnChangePlugin
          onChange={(state) => {
            setDraft(serializeEditorState(state))
            rememberDraft(sessionRef.current ?? null, state)
          }}
        />
        <SlashSkillPlugin skills={skills} picker={picker} setPicker={setPicker} />
        <AtFilePlugin hits={fileHits} picker={filePicker} setPicker={setFilePicker} />
        <ComposerKeyPlugin isStreaming={isStreaming} onSubmit={submit} />
        <ComposerPastePlugin cwd={cwd} />

        <div className="flex items-center justify-between gap-2 px-0.5 text-xs">
          <div className="flex min-w-0 flex-1 items-center gap-2">
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

          <div className="flex shrink-0 items-center gap-1.5">
            <ContextUsageRing />
            <ModelSelect />

            {isStreaming && !hasDraft ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      size="icon-sm"
                      className="rounded-full shadow-xs"
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
                      className="rounded-full shadow-xs transition-opacity"
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
}: {
  isStreaming: boolean
  onSubmit: (mode?: 'steer' | 'followUp') => void
}) {
  const [editor] = useLexicalComposerContext()

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
