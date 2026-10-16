import { describe, expect, it } from 'vitest'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  type TextNode,
} from 'lexical'
import type { CommandInfo } from '@shared/protocol'
import { COMMAND_STYLE, registerCommandHighlight } from './command-highlight'
import { serializeEditorState } from './serialize'

const commands: CommandInfo[] = [
  { name: 'deploy', source: 'extension' },
  { name: 'review', source: 'prompt' },
]

function setup() {
  const editor = createEditor({
    namespace: 'test',
    onError: (error) => {
      throw error
    },
  })
  registerCommandHighlight(editor, commands)
  const type = (text: string) =>
    editor.update(
      () => {
        $getRoot().clear()
        $getRoot().append($createParagraphNode().append($createTextNode(text)))
      },
      { discrete: true },
    )
  const pieces = () =>
    editor.getEditorState().read(() =>
      $getRoot()
        .getAllTextNodes()
        .map((node) => [
          node.getStyle() === COMMAND_STYLE ? 'command' : 'text',
          node.getTextContent(),
        ]),
    )
  return { editor, type, pieces }
}

describe('registerCommandHighlight', () => {
  it('colors the extension command a message starts with', () => {
    const { editor, type, pieces } = setup()
    type('/deploy prod')
    expect(pieces()).toEqual([
      ['command', '/deploy'],
      ['text', ' prod'],
    ])
    expect(serializeEditorState(editor.getEditorState())).toBe('/deploy prod')
  })

  it('leaves other text plain', () => {
    const { type, pieces } = setup()
    for (const text of ['hi /deploy', '/deployx', '/review this']) {
      type(text)
      expect(pieces()).toEqual([['text', text]])
    }
  })

  it('turns back into plain text once it is no longer a command', () => {
    const { editor, type, pieces } = setup()
    type('/deploy prod')
    editor.update(
      () => {
        const command = $getRoot().getAllTextNodes()[0] as TextNode
        command.setTextContent('/depl')
      },
      { discrete: true },
    )
    expect(pieces()).toEqual([['text', '/depl prod']])
  })
})
