import { describe, expect, it, beforeEach } from 'vitest'
import {
  $createNodeSelection,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  createEditor,
  type LexicalEditor,
} from 'lexical'
import {
  activateSession,
  clearDrafts,
  historyFor,
  moveDraft,
  readDraft,
  rememberDraft,
} from './drafts'
import { $createFileNode, FileNode } from './FileNode'
import { serializeEditorState } from './serialize'
import { $createSkillNode, $isSkillNode, SkillNode } from './SkillNode'

function createTestEditor() {
  return createEditor({
    namespace: 'test',
    nodes: [SkillNode, FileNode],
    onError: (error) => {
      throw error
    },
  })
}

function writeCaret(editor: LexicalEditor, text: string, anchor: number, focus = anchor) {
  editor.update(
    () => {
      const textNode = $createTextNode(text)
      const paragraph = $createParagraphNode()
      paragraph.append(textNode)
      $getRoot().clear()
      $getRoot().append(paragraph)
      textNode.select(anchor, focus)
    },
    { discrete: true },
  )
}

function caretOf(editor: LexicalEditor) {
  return editor.getEditorState().read(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return null
    return {
      text: selection.anchor.getNode().getTextContent(),
      anchor: selection.anchor.offset,
      focus: selection.focus.offset,
    }
  })
}

describe('session drafts', () => {
  beforeEach(() => {
    clearDrafts()
  })

  it('keeps unsent text on the session it was typed in', () => {
    const editor = createTestEditor()
    writeCaret(editor, 'for a', 5)
    moveDraft(editor, 'a', 'b')
    expect(serializeEditorState(editor.getEditorState())).toBe('')

    writeCaret(editor, 'for b', 5)
    moveDraft(editor, 'b', 'a')
    expect(serializeEditorState(editor.getEditorState())).toBe('for a')

    moveDraft(editor, 'a', 'b')
    expect(serializeEditorState(editor.getEditorState())).toBe('for b')
  })

  it('does not let a missing source session clobber a stored draft', () => {
    const editor = createTestEditor()
    writeCaret(editor, 'saved', 5)
    rememberDraft('a', editor.getEditorState())
    writeCaret(editor, 'unsaved', 7)

    moveDraft(editor, null, 'a')
    expect(serializeEditorState(editor.getEditorState())).toBe('saved')
  })

  it('drops a session draft when its editor is cleared', () => {
    const editor = createTestEditor()
    writeCaret(editor, 'keep', 4)
    rememberDraft('a', editor.getEditorState())
    writeCaret(editor, 'drop', 4)
    rememberDraft('b', editor.getEditorState())
    writeCaret(editor, '', 0)
    rememberDraft('b', editor.getEditorState())

    expect(readDraft('b')).toBeUndefined()
    moveDraft(editor, null, 'a')
    expect(serializeEditorState(editor.getEditorState())).toBe('keep')
  })

  it('restores chips, a non-collapsed range, and a caret after a chip', () => {
    const editor = createTestEditor()
    editor.update(
      () => {
        const text = $createTextNode('please')
        const paragraph = $createParagraphNode()
        paragraph.append(
          $createSkillNode('tdd', 'Test-driven development'),
          text,
          $createFileNode('src/Composer.tsx'),
        )
        $getRoot().clear()
        $getRoot().append(paragraph)
        text.select(1, 4)
      },
      { discrete: true },
    )
    moveDraft(editor, 'a', 'b')
    moveDraft(editor, 'b', 'a')

    expect(serializeEditorState(editor.getEditorState())).toBe(
      '/skill:tdd please @file:src/Composer.tsx',
    )
    expect(caretOf(editor)).toEqual({ text: 'please', anchor: 1, focus: 4 })
  })

  it('restores a selected chip', () => {
    const editor = createTestEditor()
    editor.update(
      () => {
        const skill = $createSkillNode('tdd', 'Test-driven development')
        const paragraph = $createParagraphNode()
        paragraph.append(skill, $createTextNode(' please'))
        $getRoot().clear()
        $getRoot().append(paragraph)
        const selection = $createNodeSelection()
        selection.add(skill.getKey())
        $setSelection(selection)
      },
      { discrete: true },
    )
    moveDraft(editor, 'a', 'b')
    moveDraft(editor, 'b', 'a')

    const selected = editor.getEditorState().read(() => {
      const selection = $getSelection()
      if (!$isNodeSelection(selection)) return null
      const node = selection.getNodes()[0]
      return $isSkillNode(node) ? node.getName() : null
    })
    expect(selected).toBe('tdd')
  })

  it('writes the live update onto the session that was activated, not the one just left', () => {
    const editor = createTestEditor()
    writeCaret(editor, 'alpha', 1)
    let current: string | null = 'a'
    const stop = editor.registerUpdateListener(({ editorState }) => {
      rememberDraft(current, editorState)
    })

    current = 'b'
    moveDraft(editor, 'a', 'b')
    writeCaret(editor, 'beta', 2)
    current = 'a'
    moveDraft(editor, 'b', 'a')

    expect(caretOf(editor)).toEqual({ text: 'alpha', anchor: 1, focus: 1 })
    stop()
  })

  it('keeps whitespace-only drafts', () => {
    const editor = createTestEditor()
    writeCaret(editor, '  ', 2)
    moveDraft(editor, 'a', 'b')
    moveDraft(editor, 'b', 'a')
    expect(serializeEditorState(editor.getEditorState())).toBe('  ')
  })

  it('keeps each session undo stack on that session', () => {
    const editor = createTestEditor()
    let unbind = activateSession(editor, null, 'a')
    writeCaret(editor, 'alpha', 1)
    editor.update(
      () => {
        $getSelection()?.insertText('!')
      },
      { discrete: true },
    )
    const depth = historyFor('a').undoStack.length
    const entry = historyFor('a').undoStack[0]?.editorState
    const entryText = entry?.read(() => serializeEditorState(entry))

    unbind()
    unbind = activateSession(editor, 'a', 'b')
    writeCaret(editor, 'beta', 0)
    editor.update(
      () => {
        $getSelection()?.insertText('?')
      },
      { discrete: true },
    )
    unbind()

    expect(historyFor('a').undoStack).toHaveLength(depth)
    const still = historyFor('a').undoStack[0]?.editorState
    expect(still?.read(() => serializeEditorState(still))).toBe(entryText)
    expect(serializeEditorState(editor.getEditorState())).toBe('?beta')
  })
})
