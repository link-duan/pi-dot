import { useEffect, type Dispatch, type SetStateAction } from 'react'
import {
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  mergeRegister,
} from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { SkillInfo } from '@shared/protocol'
import { filterSkills } from '@/lib/slash-query'
import { $replaceSlashQueryWithSkill, $slashQueryAtCaret } from './insert-skill'

export type SkillPickerState = { query: string; index: number }

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
    function insert(skill: SkillInfo) {
      editor.update(() => {
        $replaceSlashQueryWithSkill(skill)
      })
      setPicker(null)
      editor.focus()
    }

    const filtered = picker ? filterSkills(skills, picker.query) : []

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const query = $slashQueryAtCaret()
          setPicker((prev) => {
            if (query == null) return prev == null ? prev : null
            if (prev?.query === query) return prev
            return { query, index: 0 }
          })
        })
      }),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          if (!picker) return false
          event?.preventDefault()
          setPicker(stepIndex(picker, filtered.length, -1))
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          if (!picker) return false
          event?.preventDefault()
          setPicker(stepIndex(picker, filtered.length, 1))
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (!picker) return false
          event?.preventDefault()
          setPicker(null)
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          if (!picker) return false
          event?.preventDefault()
          const skill = filtered[picker.index]
          if (skill) insert(skill)
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (!picker) return false
          event?.preventDefault()
          const skill = filtered[picker.index]
          if (skill) insert(skill)
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    )
  }, [editor, picker, setPicker, skills])

  return null
}

function stepIndex(prev: SkillPickerState, count: number, delta: number): SkillPickerState {
  if (count === 0) return prev
  return { ...prev, index: (prev.index + delta + count) % count }
}
