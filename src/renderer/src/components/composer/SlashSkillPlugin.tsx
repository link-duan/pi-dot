import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { mergeRegister } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { SkillInfo } from '@shared/protocol'
import { filterSlashItems } from '@/lib/slash-query'
import { $applySlashItem, $slashQueryAtCaret } from './insert-skill'
import { applyPickerQuery, registerPickerKeys, type PickerState } from './picker-keys'

export type SkillPickerState = PickerState

export function SlashSkillPlugin({
  skills,
  picker,
  setPicker,
  onCommand,
}: {
  skills: SkillInfo[]
  picker: SkillPickerState | null
  setPicker: Dispatch<SetStateAction<SkillPickerState | null>>
  onCommand: (name: string) => void
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const filtered = picker ? filterSlashItems(skills, picker.query) : []

    function insert(index: number): boolean {
      const item = filtered[index]
      if (!item) return false
      editor.update(() => {
        $applySlashItem(item)
      })
      setPicker(null)
      if (item.kind === 'command') onCommand(item.name)
      editor.focus()
      return true
    }

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => applyPickerQuery(setPicker, $slashQueryAtCaret()))
      }),
      registerPickerKeys(editor, { picker, count: filtered.length, setPicker, insert }),
    )
  }, [editor, onCommand, picker, setPicker, skills])

  return null
}
