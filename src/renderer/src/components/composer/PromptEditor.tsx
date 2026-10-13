import { useCallback, useEffect, useState } from 'react'
import {
  $createParagraphNode,
  $getRoot,
  COMMAND_PRIORITY_NORMAL,
  INSERT_LINE_BREAK_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  mergeRegister,
  type EditorState,
} from 'lexical'
import type { InitialConfigType } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import type { FileHit } from '@shared/protocol'
import type { SlashItem } from '@/lib/slash-query'
import { useSession } from '@/session/store'
import { FilePicker } from '../FilePicker'
import { SkillPicker } from '../SkillPicker'
import { AtFilePlugin, type FilePickerState } from './AtFilePlugin'
import { ComposerPastePlugin } from './ComposerPastePlugin'
import { FileNode } from './FileNode'
import { $replaceAtQueryWithFile } from './insert-file'
import { $applySlashItem } from './insert-skill'
import { SkillNode } from './SkillNode'
import { SlashSkillPlugin, type SkillPickerState } from './SlashSkillPlugin'
import { serializeEditorState } from './serialize'

export function promptEditorConfig(namespace: string): InitialConfigType {
  return {
    namespace,
    onError(error: Error) {
      console.error(error)
    },
    nodes: [SkillNode, FileNode],
    theme: {
      paragraph: 'm-0',
    },
  }
}

export function $clearEditor(): void {
  $getRoot().clear()
  $getRoot().append($createParagraphNode())
}

/**
 * The editable area with `/` skill and `@` file pickers and file-chip paste.
 * Must sit inside a `LexicalComposer`; the pickers open above the nearest positioned ancestor.
 */
export function PromptEditorField({
  id,
  placeholder,
  className,
  onChange,
  onCommand,
}: {
  id?: string
  placeholder: string
  className?: string
  onChange?: (text: string, state: EditorState) => void
  onCommand?: (name: string) => void
}) {
  const [editor] = useLexicalComposerContext()
  const cwd = useSession((state) => state.cwd)
  const skills = useSession((state) => state.skills)
  const commands = useSession((state) => state.commands)
  const [picker, setPicker] = useState<SkillPickerState | null>(null)
  const [filePicker, setFilePicker] = useState<FilePickerState | null>(null)
  const [fileResults, setFileResults] = useState<{ query: string; hits: FileHit[] }>({
    query: '',
    hits: [],
  })

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
    (item: SlashItem) => {
      editor.update(() => {
        $applySlashItem(item)
      })
      setPicker(null)
      if (item.kind === 'command') onCommand?.(item.name)
      editor.focus()
    },
    [editor, onCommand],
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
    <>
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
          commands={onCommand ? commands : null}
          query={picker.query}
          index={picker.index}
          onHover={(index) => setPicker((prev) => (prev ? { ...prev, index } : prev))}
          onSelect={insertPicked}
        />
      ) : null}

      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              id={id}
              aria-placeholder={placeholder}
              placeholder={
                <div className="pointer-events-none absolute top-1.5 left-1.5 text-muted-foreground/60 select-none">
                  {placeholder}
                </div>
              }
              className={className}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      {onChange ? (
        <OnChangePlugin onChange={(state) => onChange(serializeEditorState(state), state)} />
      ) : null}
      <SlashSkillPlugin
        skills={skills}
        commands={commands}
        picker={picker}
        setPicker={setPicker}
        onCommand={onCommand}
      />
      <AtFilePlugin hits={fileHits} picker={filePicker} setPicker={setFilePicker} />
      <ComposerPastePlugin cwd={cwd} />
    </>
  )
}

/** Enter submits, Shift+Enter breaks the line, Esc cancels without closing an enclosing dialog. */
export function PromptSubmitPlugin({
  onSubmit,
  onEscape,
}: {
  onSubmit: () => void
  onEscape?: () => void
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          event?.preventDefault()
          if (event?.shiftKey) {
            editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false)
          } else {
            onSubmit()
          }
          return true
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (!onEscape) return false
          event.preventDefault()
          event.stopPropagation()
          onEscape()
          return true
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    )
  }, [editor, onEscape, onSubmit])

  return null
}
