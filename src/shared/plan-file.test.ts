import { describe, expect, it } from 'vitest'
import { parsePlan } from './plan-file'

describe('parsePlan', () => {
  it('reads name and overview from the frontmatter and strips it from the body', () => {
    const text =
      '---\nname: Fix login\noverview: "Token expiry: refresh it."\n---\n\n## Context\nWhy'
    const plan = parsePlan(text)
    expect(plan).toEqual({
      name: 'Fix login',
      overview: 'Token expiry: refresh it.',
      body: '## Context\nWhy',
      bodyLine: 6,
    })
  })

  it('falls back when the frontmatter is missing, partial, or invalid', () => {
    expect(parsePlan('## Context\nWhy')).toMatchObject({
      name: 'Plan',
      overview: '',
      body: '## Context\nWhy',
      bodyLine: 1,
    })
    expect(parsePlan('---\noverview: Only this\n---\nBody')).toMatchObject({
      name: 'Plan',
      overview: 'Only this',
      body: 'Body',
    })
    expect(parsePlan('---\nname: [oops\n---\nBody')).toMatchObject({
      name: 'Plan',
      overview: '',
      body: 'Body',
    })
  })

  it('normalizes CRLF so body offsets match what Markdown parsers see, counting lines as in the file', () => {
    expect(parsePlan('---\r\nname: A\r\n---\r\n\r\n## X\r\nY\r\n')).toMatchObject({
      name: 'A',
      body: '## X\nY',
      bodyLine: 5,
    })
  })
})
