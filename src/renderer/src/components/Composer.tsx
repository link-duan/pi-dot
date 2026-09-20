import { ArrowUp, Folder, Square } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  $createParagraphNode,
  $getRoot,
  COMMAND_PRIORITY_NORMAL,
  INSERT_LINE_BREAK_COMMAND,
  KEY_ENTER_COMMAND,
} from 'lexical'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import type { FileHit, SkillInfo } from '@shared/protocol'
import { useChat } from '@/chat/store'
import { Button } from '@/components/ui/button'
import { displayPath } from '@/lib/path'
import { useSession } from '@/session/store'
import { FilePicker } from './FilePicker'
import { SkillPicker } from './SkillPicker'
import { AtFilePlugin, type FilePickerState } from './composer/AtFilePlugin'
import { ComposerPastePlugin } from './composer/ComposerPastePlugin'
import { FileNode } from './composer/FileNode'
import { $replaceAtQueryWithFile } from './composer/insert-file'
import { $replaceSlashQueryWithSkill } from './composer/insert-skill'
import { SkillNode } from './composer/SkillNode'
import { SlashSkillPlugin, type SkillPickerState } from './composer/SlashSkillPlugin'
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

export function Composer() {
  return (
    <LexicalComposer initialConfig={initialConfig}>
      <ComposerForm />
    </LexicalComposer>
  )
}

function ComposerForm() {
  const [editor] = useLexicalComposerContext()
  const [draft, setDraft] = useState('')
  const [picker, setPicker] = useState<SkillPickerState | null>(null)
  const [filePicker, setFilePicker] = useState<FilePickerState | null>(null)
  const [fileResults, setFileResults] = useState<{ query: string; hits: FileHit[] }>({
    query: '',
    hits: [],
  })
  const cwd = useSession((state) => state.cwd)
  const connection = useSession((state) => state.connection)
  const skills = useSession((state) => state.skills)
  const send = useSession((state) => state.send)
  const abort = useSession((state) => state.abort)
  const openFolder = useSession((state) => state.openFolder)
  const isStreaming = useChat((state) => state.isStreaming)
  const canSend = connection === 'ready' && draft.trim().length > 0 && !isStreaming

  const submit = useCallback(() => {
    const next = serializeEditorState(editor.getEditorState()).trim()
    if (!next || isStreaming || connection !== 'ready') return
    editor.update(() => {
      $getRoot().clear()
      $getRoot().append($createParagraphNode())
    })
    setDraft('')
    setPicker(null)
    setFilePicker(null)
    void send(next)
  }, [connection, editor, isStreaming, send])

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

  return (
    <form
      className="pointer-events-none relative z-10 -mt-6 shrink-0 px-4 pt-1 pb-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="pointer-events-auto relative mx-auto max-w-3xl rounded-2xl border border-border/80 bg-card/90 px-1.5 pt-1 pb-1 shadow-xl shadow-black/5 backdrop-blur-md dark:bg-[#121316]/95 dark:shadow-black/50">
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
        <HistoryPlugin />
        <OnChangePlugin
          onChange={(state) => {
            setDraft(serializeEditorState(state))
          }}
        />
        <SlashSkillPlugin skills={skills} picker={picker} setPicker={setPicker} />
        <AtFilePlugin hits={fileHits} picker={filePicker} setPicker={setFilePicker} />
        <ComposerKeyPlugin onSubmit={submit} />
        <ComposerPastePlugin cwd={cwd} />

        <div className="flex items-center justify-between gap-2 px-0.5 text-xs">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {cwd ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => void openFolder()}
                className="max-w-full min-w-0 text-xs text-muted-foreground"
                title={`Current folder: ${cwd} (click to change)`}
              >
                <Folder className="size-3 shrink-0" />
                <span className="truncate">{displayPath(cwd, null, window.pi.homedir)}</span>
              </Button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <ContextUsageRing />
            <ModelSelect />

            {isStreaming ? (
              <Button
                type="button"
                size="icon-sm"
                className="rounded-full shadow-xs"
                aria-label="Stop"
                onClick={() => void abort()}
              >
                <Square className="size-2.5 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-sm"
                className="rounded-full shadow-xs transition-opacity"
                disabled={!canSend}
                aria-label="Send"
              >
                <ArrowUp className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}

function ComposerKeyPlugin({ onSubmit }: { onSubmit: () => void }) {
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
        event?.preventDefault()
        onSubmit()
        return true
      },
      COMMAND_PRIORITY_NORMAL,
    )
  }, [editor, onSubmit])

  return null
}
