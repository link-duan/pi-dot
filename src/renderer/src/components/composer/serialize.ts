import {
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  type EditorState,
  type LexicalNode,
} from 'lexical'
import { $isSkillNode } from './SkillNode'

export type SerializePiece = { type: 'text'; text: string } | { type: 'skill'; name: string }

export function joinPieces(pieces: SerializePiece[]): string {
  let out = ''
  let afterSkill = false
  for (const piece of pieces) {
    if (piece.type === 'skill') {
      if (out && !/\s$/.test(out)) out += ' '
      out += `/skill:${piece.name}`
      afterSkill = true
      continue
    }
    if (afterSkill && piece.text && !/^\s/.test(piece.text)) out += ' '
    afterSkill = false
    out += piece.text
  }
  return out
}

export function serializeEditorState(state: EditorState): string {
  return state.read(() => {
    const pieces: SerializePiece[] = []
    const children = $getRoot().getChildren()
    children.forEach((paragraph, index) => {
      if (index > 0) pieces.push({ type: 'text', text: '\n' })
      collect(paragraph, pieces)
    })
    return joinPieces(pieces)
  })
}

function collect(node: LexicalNode, pieces: SerializePiece[]): void {
  if ($isSkillNode(node)) {
    pieces.push({ type: 'skill', name: node.getName() })
    return
  }
  if ($isTextNode(node)) {
    pieces.push({ type: 'text', text: node.getTextContent() })
    return
  }
  if ($isLineBreakNode(node)) {
    pieces.push({ type: 'text', text: '\n' })
    return
  }
  if ($isElementNode(node)) {
    for (const child of node.getChildren()) collect(child, pieces)
  }
}
