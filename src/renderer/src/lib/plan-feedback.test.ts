import { describe, expect, it } from 'vitest'
import { PLAN_APPROVED_PROMPT } from '@shared/protocol'
import { formatApproval, formatPlanFeedback, reanchor, type PlanComment } from './plan-feedback'

function comment(start: number, quote: string, text = 'why?'): PlanComment {
  return { id: `${start}`, text, start, end: start + quote.length, quote }
}

const text = `---
name: Demo
overview: x
---

## Context
Results arrive out of order.

## Files to change
- debounce the query
  by 120 ms
`
const plan = text
const body = text.slice(text.indexOf('## Context')).trim()
const at = (quote: string, note = 'why?') => comment(body.indexOf(quote), quote, note)

describe('formatPlanFeedback', () => {
  it('locates each inline comment by plan file line and section, in document order', () => {
    const message = formatPlanFeedback(
      [
        at('debounce the query\n  by 120 ms', 'Too short'),
        at('out of order', 'Measure first\nthen fix'),
      ],
      'Also add tests',
      plan,
    )
    expect(message).toBe(
      [
        '1. Line 7, under "Context"',
        '   > out of order',
        '   Measure first',
        '   then fix',
        '',
        '2. Lines 10-11, under "Files to change"',
        '   > debounce the query',
        '   >   by 120 ms',
        '   Too short',
        '',
        '---',
        '',
        'Also add tests',
      ].join('\n'),
    )
  })

  it('sends a lone general comment as is, and labels outdated inline comments', () => {
    expect(formatPlanFeedback([], '  Looks off  ', plan)).toBe('Looks off')
    expect(formatPlanFeedback([{ ...at('gone'), start: 0, outdated: true }], '', plan)).toContain(
      '1. Outdated (this text is no longer in the plan)\n   > gone',
    )
    expect(formatPlanFeedback([], ' ', plan)).toBe('')
  })
})

describe('section headings', () => {
  const fenced = `## Setup\n\n\`\`\`sh\n# install deps\nnpm i\n\`\`\`\n\nRun it.\n\n## Foo Bar\n\nText.`
  const locateIn = (quote: string) => {
    const body = fenced
    return formatPlanFeedback([comment(body.indexOf(quote), quote)], '', body).split('\n')[0]
  }

  it('ignores # lines inside code blocks', () => {
    expect(locateIn('Run it.')).toBe('1. Line 8, under "Setup"')
  })

  it('recognizes underlined (setext) headings', () => {
    const body = 'Intro\n=====\n\nA.\n\nContext\n-------\n\nB.'
    const at = (quote: string) =>
      formatPlanFeedback([comment(body.indexOf(quote), quote)], '', body).split('\n')[0]
    expect(at('Context')).toBe('1. Line 6, under "Context"')
    expect(at('B.')).toBe('1. Line 9, under "Context"')
  })

  it('uses the whole heading when the comment starts on or inside it', () => {
    expect(locateIn('Foo Bar')).toBe('1. Line 10, under "Foo Bar"')
    expect(locateIn('Bar')).toBe('1. Line 10, under "Foo Bar"')
  })
})

describe('formatApproval', () => {
  it('is the plain approval without comments, and carries them otherwise', () => {
    expect(formatApproval([], plan)).toBe(PLAN_APPROVED_PROMPT)
    expect(formatApproval([{ ...at('gone'), start: 0, outdated: true }], plan)).toContain(
      'Also address these comments:\n\n1. Outdated (this text is no longer in the plan)',
    )
    expect(formatApproval([at('out of order', 'mind y')], plan)).toBe(
      `${PLAN_APPROVED_PROMPT} Also address these comments:\n\n1. Line 7, under "Context"\n   > out of order\n   mind y`,
    )
  })
})

describe('reanchor', () => {
  it('keeps comments whose quote is still in place', () => {
    const comments = [comment(4, 'beta')]
    expect(reanchor(comments, 'alfabetagamma')).toBe(comments)
  })

  it('moves a comment to the occurrence of its quote nearest the old spot', () => {
    const [moved] = reanchor([comment(10, 'foo')], 'foo ... ## foo here ... foo')
    expect(moved).toMatchObject({ start: 11, end: 14, outdated: false })
  })

  it('returns the same array when an outdated comment is still gone', () => {
    const comments = [{ ...comment(0, 'gone'), outdated: true }]
    expect(reanchor(comments, 'still missing')).toBe(comments)
  })

  it('moves two comments on the same quote to their own nearest occurrences', () => {
    const [a, b] = reanchor([comment(1, 'ab'), comment(9, 'ab')], 'xxab....xab')
    expect([a?.start, b?.start]).toEqual([2, 9])
  })

  it('marks comments outdated when the quote is gone, and restores them if it comes back', () => {
    const [gone] = reanchor([comment(0, 'removed')], 'something else')
    expect(gone?.outdated).toBe(true)
    const [back] = reanchor([gone!], 'removed again')
    expect(back).toMatchObject({ start: 0, outdated: false })
  })
})
