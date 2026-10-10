import type { Dispatch, SetStateAction } from 'react'
import {
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  mergeRegister,
  type LexicalEditor,
} from 'lexical'

export type PickerState = { query: string; index: number }

export function stepIndex<T extends PickerState>(prev: T, count: number, delta: number): T {
  if (count === 0) return prev
  return { ...prev, index: (prev.index + delta + count) % count }
}

export function applyPickerQuery(
  setPicker: Dispatch<SetStateAction<PickerState | null>>,
  query: string | null,
): void {
  setPicker((prev) => {
    if (query == null) return prev == null ? prev : null
    if (prev?.query === query) return prev
    return { query, index: 0 }
  })
}

export function registerPickerKeys(
  editor: LexicalEditor,
  {
    picker,
    count,
    setPicker,
    insert,
  }: {
    picker: PickerState | null
    count: number
    setPicker: Dispatch<SetStateAction<PickerState | null>>
    insert: (index: number) => boolean
  },
): () => void {
  return mergeRegister(
    editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        if (!picker) return false
        event?.preventDefault()
        setPicker(stepIndex(picker, count, -1))
        return true
      },
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        if (!picker) return false
        event?.preventDefault()
        setPicker(stepIndex(picker, count, 1))
        return true
      },
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (event) => {
        if (!picker) return false
        event?.preventDefault()
        // Don't let it also close an enclosing dialog or popover.
        event?.stopPropagation()
        setPicker(null)
        return true
      },
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        // Shift+Tab toggles plan mode rather than picking.
        if (!picker || event?.shiftKey) return false
        event?.preventDefault()
        insert(picker.index)
        return true
      },
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (!picker) return false
        if (!insert(picker.index)) return false
        event?.preventDefault()
        return true
      },
      COMMAND_PRIORITY_HIGH,
    ),
  )
}
