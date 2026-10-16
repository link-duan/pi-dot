import { useEffect } from 'react'
import {
  COMMAND_PRIORITY_NORMAL,
  INSERT_LINE_BREAK_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  mergeRegister,
} from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'

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
