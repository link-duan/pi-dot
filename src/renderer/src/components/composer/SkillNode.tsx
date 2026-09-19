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
import { SkillChip } from './SkillChip'

export type SerializedSkillNode = Spread<
  {
    name: string
    description?: string
  },
  SerializedLexicalNode
>

export class SkillNode extends DecoratorNode<ReactNode> {
  __name: string
  __description?: string

  static getType(): string {
    return 'skill'
  }

  static clone(node: SkillNode): SkillNode {
    return new SkillNode(node.__name, node.__description, node.__key)
  }

  constructor(name: string, description?: string, key?: NodeKey) {
    super(key)
    this.__name = name
    this.__description = description
  }

  getName(): string {
    return this.__name
  }

  getDescription(): string | undefined {
    return this.__description
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'skill-chip-host inline-flex align-middle'
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

  static importJSON(serialized: SerializedSkillNode): SkillNode {
    return $createSkillNode(serialized.name, serialized.description)
  }

  exportJSON(): SerializedSkillNode {
    return {
      ...super.exportJSON(),
      type: 'skill',
      name: this.__name,
      description: this.__description,
    }
  }

  decorate(): ReactNode {
    return <SkillDecorator nodeKey={this.getKey()} name={this.__name} />
  }
}

export function $createSkillNode(name: string, description?: string): SkillNode {
  return $applyNodeReplacement(new SkillNode(name, description))
}

export function $isSkillNode(node: LexicalNode | null | undefined): node is SkillNode {
  return node instanceof SkillNode
}

function SkillDecorator({ nodeKey, name }: { nodeKey: string; name: string }) {
  const [selected, setSelected] = useLexicalNodeSelection(nodeKey)
  return (
    <SkillChip
      name={name}
      selected={selected}
      onMouseDown={(event) => {
        event.preventDefault()
        setSelected(true)
      }}
    />
  )
}
