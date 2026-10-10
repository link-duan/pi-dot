// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { sourceOffset, sourceRanges, textBoundary } from './plan-blocks'

// What PlanDocument renders for a body: "## Title\n\nSome *bold* text.\n\n```\ncode\n```"
// blocks at 0, 10 and 30; span offsets are relative to their block.
const html = `
  <div data-plan-block data-start="0" data-end="8"><h2><span data-src="3" data-src-end="8">Title</span></h2></div>
  <div data-plan-block data-start="10" data-end="28"><p><span data-src="0" data-src-end="5">Some </span><em><span data-src="6" data-src-end="10">bold</span></em><span data-src="11" data-src-end="17"> text.</span></p>
    <div data-plan-thread><p>a comment</p></div></div>
  <div data-plan-block data-start="30" data-end="42"><pre>code</pre></div>`

let root: HTMLElement
const text = (selector: string) => root.querySelector(selector)!.firstChild!

beforeEach(() => {
  document.body.innerHTML = `<div id="root">${html}</div>`
  root = document.getElementById('root')!
})

describe('sourceOffset', () => {
  it('adds the block start to the offset within the text', () => {
    expect(sourceOffset(text('[data-src="6"]'), 1, 'start')).toBe(17) // "o" of bold
    expect(sourceOffset(text('[data-src="3"]'), 5, 'end')).toBe(8)
  })

  it('anchors unwrapped content such as code blocks to the whole block', () => {
    expect(sourceOffset(text('pre'), 2, 'start')).toBe(30)
    expect(sourceOffset(text('pre'), 2, 'end')).toBe(42)
  })
})

describe('sourceRanges', () => {
  it('covers exactly the quoted part of each span', () => {
    const ranges = sourceRanges(root, 12, 20) // "me *bold" → "me ", "bold"
    expect(ranges.map((range) => range.toString())).toEqual(['me ', 'bold'])
  })
})

describe('textBoundary', () => {
  it('moves an element boundary to the next text for a start and the previous text for an end', () => {
    const p = root.querySelector('p')!
    expect(textBoundary(root, p, 1, 'start')).toEqual([text('[data-src="6"]'), 0])
    // A triple-click ends at the start of the next block: the end belongs to the text before it.
    const next = root.querySelectorAll('[data-plan-block]')[1]!
    const [node, offset] = textBoundary(root, next, 0, 'end')
    expect(node).toBe(text('[data-src="3"]'))
    expect(offset).toBe(5)
  })

  it('maps a start at the end of an element to the text after it, not inside it', () => {
    const h2 = root.querySelector('h2')!
    expect(textBoundary(root, h2, h2.childNodes.length, 'start')[0]).toBe(text('[data-src="0"]'))
  })
})
