import { $createParagraphNode, $getRoot } from 'lexical'
import type { InitialConfigType } from '@lexical/react/LexicalComposer'
import { FileNode } from './FileNode'
import { SkillNode } from './SkillNode'

export function promptEditorConfig(namespace: string): InitialConfigType {
  return {
    namespace,
    onError(error: Error) {
      console.error(error)
    },
    nodes: [SkillNode, FileNode],
    theme: {
      paragraph: 'm-0',
    },
  }
}

export function $clearEditor(): void {
  $getRoot().clear()
  $getRoot().append($createParagraphNode())
}
