import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { mergeRegister } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { FileHit } from '@shared/protocol'
import { $atQueryAtCaret, $replaceAtQueryWithFile } from './insert-file'
import { applyPickerQuery, registerPickerKeys, type PickerState } from './picker-keys'

export type FilePickerState = PickerState

export function AtFilePlugin({
  hits,
  picker,
  setPicker,
}: {
  hits: FileHit[]
  picker: FilePickerState | null
  setPicker: Dispatch<SetStateAction<FilePickerState | null>>
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    function insert(index: number): boolean {
      const hit = hits[index]
      if (!hit) return false
      editor.update(() => {
        $replaceAtQueryWithFile(hit)
      })
      setPicker(null)
      editor.focus()
      return true
    }

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => applyPickerQuery(setPicker, $atQueryAtCaret()))
      }),
      registerPickerKeys(editor, { picker, count: hits.length, setPicker, insert }),
    )
  }, [editor, hits, picker, setPicker])

  return null
}
