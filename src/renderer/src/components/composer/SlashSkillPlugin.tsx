import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { mergeRegister } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { SkillInfo } from '@shared/protocol'
import { filterSkills } from '@/lib/slash-query'
import { $replaceSlashQueryWithSkill, $slashQueryAtCaret } from './insert-skill'
import { applyPickerQuery, registerPickerKeys, type PickerState } from './picker-keys'

export type SkillPickerState = PickerState

export function SlashSkillPlugin({
  skills,
  picker,
  setPicker,
}: {
  skills: SkillInfo[]
  picker: SkillPickerState | null
  setPicker: Dispatch<SetStateAction<SkillPickerState | null>>
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const filtered = picker ? filterSkills(skills, picker.query) : []

    function insert(index: number): boolean {
      const skill = filtered[index]
      if (!skill) return false
      editor.update(() => {
        $replaceSlashQueryWithSkill(skill)
      })
      setPicker(null)
      editor.focus()
      return true
    }

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => applyPickerQuery(setPicker, $slashQueryAtCaret()))
      }),
      registerPickerKeys(editor, { picker, count: filtered.length, setPicker, insert }),
    )
  }, [editor, picker, setPicker, skills])

  return null
}
