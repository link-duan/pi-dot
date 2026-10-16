import { $createParagraphNode, $createTextNode, $getRoot, type ParagraphNode } from 'lexical'
import { parseUserSegments } from '@/lib/user-message'
import { $createFileNode } from './FileNode'
import { $createSkillNode } from './SkillNode'

/** Replaces the Composer's content with `text`, turning skill and file tokens back into chips. */
export function $setComposerText(text: string): void {
  const root = $getRoot()
  root.clear()
  let paragraph: ParagraphNode = $createParagraphNode()
  root.append(paragraph)
  for (const segment of parseUserSegments(text)) {
    if (segment.type === 'skill') paragraph.append($createSkillNode(segment.name))
    else if (segment.type === 'file') paragraph.append($createFileNode(segment.path, segment.range))
    else {
      segment.text.split('\n').forEach((line, index) => {
        if (index > 0) {
          paragraph = $createParagraphNode()
          root.append(paragraph)
        }
        if (line) paragraph.append($createTextNode(line))
      })
    }
  }
  root.selectEnd()
}
