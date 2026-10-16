import { describe, expect, it } from 'vitest'
import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from 'lexical'
import { FileNode } from './FileNode'
import { $replaceAtQueryWithFile } from './insert-file'
import { $replaceSlashQueryWithSkill } from './insert-skill'
import { SkillNode } from './SkillNode'
import { joinPieces, serializeEditorState } from './serialize'

describe('joinPieces', () => {
  it('joins text as-is', () => {
    expect(joinPieces([{ type: 'text', text: 'hello world' }])).toBe('hello world')
  })

  it('serializes a leading skill', () => {
    expect(joinPieces([{ type: 'skill', name: 'tdd' }])).toBe('/skill:tdd')
    expect(
      joinPieces([
        { type: 'skill', name: 'tdd' },
        { type: 'text', text: 'fix tests' },
      ]),
    ).toBe('/skill:tdd fix tests')
  })

  it('inserts spaces around a mid-text skill', () => {
    expect(
      joinPieces([
        { type: 'text', text: 'please use' },
        { type: 'skill', name: 'tdd' },
        { type: 'text', text: 'on this file' },
      ]),
    ).toBe('please use /skill:tdd on this file')
  })

  it('keeps existing whitespace', () => {
    expect(
      joinPieces([
        { type: 'text', text: 'please use ' },
        { type: 'skill', name: 'tdd' },
        { type: 'text', text: ' on this file' },
      ]),
    ).toBe('please use /skill:tdd on this file')
  })

  it('serializes multiple skills and line breaks', () => {
    expect(
      joinPieces([
        { type: 'skill', name: 'tdd' },
        { type: 'text', text: '\n' },
        { type: 'skill', name: 'react-doctor' },
      ]),
    ).toBe('/skill:tdd\n/skill:react-doctor')
  })

  it('serializes a file chip as @file:path', () => {
    expect(
      joinPieces([
        { type: 'text', text: 'see' },
        { type: 'file', path: 'src/foo.ts' },
        { type: 'text', text: 'please' },
      ]),
    ).toBe('see @file:src/foo.ts please')
  })

  it('serializes a ranged file next to a skill', () => {
    expect(
      joinPieces([
        { type: 'skill', name: 'tdd' },
        { type: 'file', path: 'src/foo.ts', range: { start: 10, end: 20 } },
      ]),
    ).toBe('/skill:tdd @file:src/foo.ts:10-20')
  })
})

describe('serializeEditorState', () => {
  it('replaces a slash query with a skill node', () => {
    const editor = createEditor({
      namespace: 'test',
      nodes: [SkillNode, FileNode],
      onError: (error) => {
        throw error
      },
    })
    editor.update(
      () => {
        const text = $createTextNode('/td')
        const paragraph = $createParagraphNode()
        paragraph.append(text)
        $getRoot().clear()
        $getRoot().append(paragraph)
        text.select(3, 3)
        $replaceSlashQueryWithSkill({ name: 'tdd', description: 'Test-driven development' })
      },
      { discrete: true },
    )
    expect(serializeEditorState(editor.getEditorState())).toBe('/skill:tdd ')
  })

  it('replaces an at query with a file node', () => {
    const editor = createEditor({
      namespace: 'test',
      nodes: [SkillNode, FileNode],
      onError: (error) => {
        throw error
      },
    })
    editor.update(
      () => {
        const text = $createTextNode('@Comp')
        const paragraph = $createParagraphNode()
        paragraph.append(text)
        $getRoot().clear()
        $getRoot().append(paragraph)
        text.select(5, 5)
        $replaceAtQueryWithFile({ path: 'src/Composer.tsx', isDirectory: false })
      },
      { discrete: true },
    )
    expect(serializeEditorState(editor.getEditorState())).toBe('@file:src/Composer.tsx ')
  })
})
