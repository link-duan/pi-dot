import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { CommandInfo } from '@shared/protocol'
import { registerCommandHighlight } from './command-highlight'

/** Colors the extension command a message starts with, in the editor that sends messages. */
export function CommandHighlightPlugin({ commands }: { commands: CommandInfo[] }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => registerCommandHighlight(editor, commands), [commands, editor])
  return null
}
