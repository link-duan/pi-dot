import type { Element, ElementContent, Root, RootContent } from 'hast'

/**
 * Wraps text in `<span data-src data-src-end>` carrying its offsets in the rendered block's
 * Markdown, so a DOM selection maps back to source. Code blocks are left alone: they render from
 * their source string. Takes no options, so every block shares one cached processor.
 */
export function rehypeSourceOffsets() {
  return (tree: Root) => {
    wrap(tree)
  }
}

function wrap(parent: Root | Element): void {
  if (parent.type === 'element' && parent.tagName === 'pre') return
  parent.children = parent.children.map((child: RootContent): RootContent => {
    if (child.type === 'element') {
      wrap(child)
      return child
    }
    if (child.type !== 'text' || !child.value.trim() || !child.position) return child
    const start = child.position.start.offset
    const end = child.position.end.offset
    if (start == null || end == null) return child
    const span: Element = {
      type: 'element',
      tagName: 'span',
      properties: { dataSrc: start, dataSrcEnd: end },
      children: [child as ElementContent],
    }
    return span
  })
}
