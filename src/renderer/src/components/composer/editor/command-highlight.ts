import { $getRoot, $isTextNode, TextNode, type LexicalEditor } from 'lexical'
import type { CommandInfo } from '@shared/protocol'
import { extensionCommand } from '@/lib/slash-query'

/**
 * How the command is set apart. Lexical text styles are inline, so this is the `--command` token
 * the Transcript uses as `text-command`; the node stays plain text, so editing works as anywhere.
 */
export const COMMAND_STYLE = 'color: var(--command);'

/**
 * Keeps the extension command a message starts with in `COMMAND_STYLE`, and everything else
 * unstyled. It is the same check sending uses, so what is colored is what runs as a command.
 */
export function registerCommandHighlight(
  editor: LexicalEditor,
  commands: CommandInfo[],
): () => void {
  const unregister = editor.registerNodeTransform(TextNode, (node) => {
    const prefix = $commandPrefix(node, commands)
    const text = node.getTextContent()
    if (node.getStyle() === COMMAND_STYLE) {
      // No longer the whole command: plain again, and merged back with its neighbours.
      if (text !== prefix) node.setStyle('')
      return
    }
    if (!prefix || !text.startsWith(prefix)) return
    const [head] = text.length > prefix.length ? node.splitText(prefix.length) : [node]
    head.setStyle(COMMAND_STYLE)
  })
  // Apply the rule to what is already there, e.g. once the commands are known.
  editor.update(() => $getRoot().getFirstDescendant()?.markDirty())
  return unregister
}

// `/name` if `node` is where the message starts and that starts with an extension command.
function $commandPrefix(node: TextNode, commands: CommandInfo[]): string | null {
  if (!node.is($getRoot().getFirstDescendant())) return null
  const next = node.getNextSibling()
  const text = node.getTextContent() + ($isTextNode(next) ? next.getTextContent() : '')
  const command = extensionCommand(text, commands)
  return command ? `/${command.name}` : null
}
