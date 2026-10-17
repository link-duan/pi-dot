import { useCallback, useEffect, useState } from 'react'
import { type EditorState } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import type { FileHit } from '@shared/protocol'
import type { SlashItem, SlashScope } from '@/lib/slash-query'
import { useSession } from '@/session/store'
import { FilePicker } from './FilePicker'
import { SkillPicker } from './SkillPicker'
import { AtFilePlugin, type FilePickerState } from './AtFilePlugin'
import { CommandHighlightPlugin } from './CommandHighlightPlugin'
import { ComposerPastePlugin } from './ComposerPastePlugin'
import { $replaceAtQueryWithFile } from './insert-file'
import { $applySlashItem } from './insert-skill'
import { SlashSkillPlugin, type SkillPickerState } from './SlashSkillPlugin'
import { serializeEditorState } from './serialize'

/**
 * The editable area with `/` skill and `@` file pickers and file-chip paste.
 * Must sit inside a `LexicalComposer`; the pickers open above `anchor`, by default the editor,
 * and flip below it when there is no room.
 */
export function PromptEditorField({
  id,
  anchor,
  placeholder,
  className,
  onChange,
  onCommand,
  scope,
}: {
  id?: string
  /** What the pickers align to; defaults to the editor. */
  anchor?: Element | null
  placeholder: string
  className?: string
  onChange?: (text: string, state: EditorState) => void
  onCommand?: (name: string) => void
  /** `message` leaves session-level commands out of the `/` picker; see `SlashScope`. */
  scope?: SlashScope
}) {
  const [editor] = useLexicalComposerContext()
  const [editorBox, setEditorBox] = useState<HTMLDivElement | null>(null)
  const pickerAnchor = anchor ?? editorBox
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
          anchor={pickerAnchor}
          hits={fileHits}
          index={filePicker.index}
          onHover={(index) => setFilePicker((prev) => (prev ? { ...prev, index } : prev))}
          onSelect={insertPickedFile}
        />
      ) : picker ? (
        <SkillPicker
          anchor={pickerAnchor}
          skills={skills}
          commands={onCommand ? commands : null}
          scope={scope}
          query={picker.query}
          index={picker.index}
          onHover={(index) => setPicker((prev) => (prev ? { ...prev, index } : prev))}
          onSelect={insertPicked}
        />
      ) : null}

      <div ref={setEditorBox} className="relative">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              id={id}
              aria-placeholder={placeholder}
              placeholder={
                <div className="pointer-events-none absolute top-1.5 left-1.5 text-subtle-foreground select-none">
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
        scope={scope}
      />
      {/* It highlights extension commands only, which the message scope leaves out. */}
      {onCommand && scope !== 'message' ? <CommandHighlightPlugin commands={commands} /> : null}
      <AtFilePlugin hits={fileHits} picker={filePicker} setPicker={setFilePicker} />
      <ComposerPastePlugin cwd={cwd} />
    </>
  )
}
