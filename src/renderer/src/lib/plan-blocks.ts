import { Lexer, type Tokens } from 'marked'

export interface PlanBlock {
  text: string
  start: number
  end: number
}

/**
 * The body's top-level Markdown blocks as exact slices, with lists split into one block per item
 * so comments can sit between items. Blank separators are skipped: they would render as empty
 * wrappers and add gaps.
 */
export function planBlocks(body: string): PlanBlock[] {
  const blocks: PlanBlock[] = []
  let cursor = 0
  for (const token of Lexer.lex(body, { gfm: true })) {
    const start = cursor
    cursor += token.raw.length
    if (token.type === 'space') continue
    if (token.type === 'list' && token.items.length > 1) {
      let at = start
      for (const item of token.items as Tokens.ListItem[]) {
        const text = item.raw.trimEnd()
        at = body.indexOf(text, at)
        blocks.push({ text, start: at, end: at + text.length })
        at += text.length
      }
    } else {
      blocks.push({ text: token.raw, start, end: cursor })
    }
  }
  return blocks
}

function blockOf(node: Node): HTMLElement | null {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
  return element?.closest<HTMLElement>('[data-plan-block]') ?? null
}

/**
 * Maps a selection boundary on a text node to a body offset: the block's start plus the offset
 * `rehypeSourceOffsets` recorded within the block.
 */
export function sourceOffset(node: Node, offset: number, edge: 'start' | 'end'): number | null {
  const block = blockOf(node)
  if (!block) return null
  const base = Number(block.dataset.start)
  const span =
    node.nodeType === Node.TEXT_NODE ? node.parentElement?.closest<HTMLElement>('[data-src]') : null
  // Code blocks and other unwrapped content anchor to the whole block.
  if (!span || !block.contains(span)) {
    return Number(edge === 'start' ? block.dataset.start : block.dataset.end)
  }
  const start = Number(span.dataset.src)
  const end = Number(span.dataset.srcEnd)
  // Entities and escapes make the text shorter than its source; fall back to the node's edge.
  if (end - start === node.textContent?.length) return base + start + offset
  return base + (edge === 'start' ? start : end)
}

/** DOM ranges covering `[start, end)` of the body, for highlighting a comment's quote. */
export function sourceRanges(root: HTMLElement, start: number, end: number): Range[] {
  const ranges: Range[] = []
  for (const span of root.querySelectorAll<HTMLElement>('[data-plan-block] [data-src]')) {
    const base = Number(blockOf(span)!.dataset.start)
    const from = base + Number(span.dataset.src)
    const to = base + Number(span.dataset.srcEnd)
    const text = span.firstChild
    if (to <= start || from >= end || !text || text.nodeType !== Node.TEXT_NODE) continue
    const range = document.createRange()
    if (to - from === text.textContent?.length) {
      range.setStart(text, Math.max(start, from) - from)
      range.setEnd(text, Math.min(end, to) - from)
    } else {
      range.selectNodeContents(text)
    }
    ranges.push(range)
  }
  return ranges
}

/**
 * Selection boundaries can sit on elements (e.g. a triple-click ends at the start of the next
 * block); move them onto the adjacent text inside `root` so they map to the right offset: the
 * first text after a start boundary, the last text before an end boundary.
 */
export function textBoundary(
  root: Node,
  node: Node,
  offset: number,
  edge: 'start' | 'end',
): [Node, number] {
  if (node.nodeType === Node.TEXT_NODE) return [node, offset]
  const boundary = document.createRange()
  boundary.setStart(node, offset)
  // Whitespace between elements isn't plan text.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, (text) =>
    text.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  )
  let found: Node | null = null
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const after = boundary.comparePoint(text, 0) >= 0
    if (edge === 'start' && after) return [text, 0]
    if (edge === 'end' && after) break
    found = text
  }
  if (edge === 'end' && found) return [found, found.textContent?.length ?? 0]
  return [node, offset]
}
