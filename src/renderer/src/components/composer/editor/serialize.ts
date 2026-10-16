import {
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  type EditorState,
  type LexicalNode,
} from 'lexical'
import { formatFileToken, type FileRange } from '@/lib/file-token'
import { $isFileNode } from './FileNode'
import { $isSkillNode } from './SkillNode'

export type SerializePiece =
  | { type: 'text'; text: string }
  | { type: 'skill'; name: string }
  | { type: 'file'; path: string; range?: FileRange }

export function joinPieces(pieces: SerializePiece[]): string {
  let out = ''
  let afterEmbed = false
  for (const piece of pieces) {
    if (piece.type === 'skill' || piece.type === 'file') {
      if (out && !/\s$/.test(out)) out += ' '
      out += piece.type === 'skill' ? `/skill:${piece.name}` : formatFileToken(piece)
      afterEmbed = true
      continue
    }
    if (afterEmbed && piece.text && !/^\s/.test(piece.text)) out += ' '
    afterEmbed = false
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
  if ($isFileNode(node)) {
    pieces.push({ type: 'file', path: node.getPath(), range: node.getRange() })
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
