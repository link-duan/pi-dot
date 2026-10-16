import {
  $applyNodeReplacement,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import type { ReactNode } from 'react'
import { fileChipLabel, type FileRange } from '@/lib/file-token'
import { FileChip } from './FileChip'

export type SerializedFileNode = Spread<
  {
    path: string
    range?: FileRange
  },
  SerializedLexicalNode
>

export class FileNode extends DecoratorNode<ReactNode> {
  __path: string
  __range?: FileRange

  static getType(): string {
    return 'file'
  }

  static clone(node: FileNode): FileNode {
    return new FileNode(node.__path, node.__range, node.__key)
  }

  constructor(path: string, range?: FileRange, key?: NodeKey) {
    super(key)
    this.__path = path
    this.__range = range
  }

  getPath(): string {
    return this.__path
  }

  getRange(): FileRange | undefined {
    return this.__range
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'file-chip-host inline-flex max-w-full align-middle'
    return span
  }

  updateDOM(): false {
    return false
  }

  isInline(): boolean {
    return true
  }

  isKeyboardSelectable(): boolean {
    return true
  }

  static importJSON(serialized: SerializedFileNode): FileNode {
    return $createFileNode(serialized.path, serialized.range)
  }

  exportJSON(): SerializedFileNode {
    return {
      ...super.exportJSON(),
      type: 'file',
      path: this.__path,
      range: this.__range,
    }
  }

  decorate(): ReactNode {
    return <FileDecorator nodeKey={this.getKey()} path={this.__path} range={this.__range} />
  }
}

export function $createFileNode(path: string, range?: FileRange): FileNode {
  return $applyNodeReplacement(new FileNode(path, range))
}

export function $isFileNode(node: LexicalNode | null | undefined): node is FileNode {
  return node instanceof FileNode
}

function FileDecorator({
  nodeKey,
  path,
  range,
}: {
  nodeKey: string
  path: string
  range?: FileRange
}) {
  const [selected, setSelected] = useLexicalNodeSelection(nodeKey)
  return (
    <FileChip
      label={fileChipLabel(path, range)}
      title={path}
      directory={path.endsWith('/')}
      selected={selected}
      onMouseDown={(event) => {
        event.preventDefault()
        setSelected(true)
      }}
    />
  )
}
