import { describe, expect, it } from 'vitest'
import { parsePlan } from '@shared/plan-file'
import { planBlocks } from './plan-blocks'

function texts(body: string): string[] {
  const blocks = planBlocks(body)
  for (const block of blocks) expect(body.slice(block.start, block.end)).toBe(block.text)
  return blocks.map((block) => block.text.trim())
}

describe('planBlocks', () => {
  it('slices the body into its top-level blocks, skipping blank separators', () => {
    expect(texts('## Context\n\nWhy this.\n\n```ts\nconst a = 1\n```\n\nDone.')).toEqual([
      '## Context',
      'Why this.',
      '```ts\nconst a = 1\n```',
      'Done.',
    ])
  })

  it('splits tight, loose and nested lists into items, and ends a list at the next heading', () => {
    expect(texts('Steps:\n\n1. one\n2. two\n   - nested\n3. three\n## Next\nEnd.')).toEqual([
      'Steps:',
      '1. one',
      '2. two\n   - nested',
      '3. three',
      '## Next',
      'End.',
    ])
    expect(texts('- a\n\n- b\n\n- c')).toEqual(['- a', '- b', '- c'])
  })

  it('keeps blocks apart around footnotes, which Streamdown would merge into one', () => {
    expect(texts('Intro[^1].\n\n## Section\n\nBody.\n\n[^1]: Note.')).toHaveLength(4)
  })

  it('stays exact for CRLF plan files once parsePlan normalizes them', () => {
    const { body } = parsePlan(
      '---\r\nname: A\r\n---\r\n## A\r\n\r\nPara one.\r\n\r\n- x\r\n- y\r\n',
    )
    expect(texts(body)).toEqual(['## A', 'Para one.', '- x', '- y'])
  })
})
