import { describe, expect, it } from 'vitest'
import { parsePlan } from './plan-file'

describe('parsePlan', () => {
  it('reads name and overview from the frontmatter and strips it from the body', () => {
    const plan = parsePlan(
      '---\nname: Fix login\noverview: "Token expiry: refresh it."\n---\n\n## Context\nWhy',
    )
    expect(plan).toEqual({
      name: 'Fix login',
      overview: 'Token expiry: refresh it.',
      body: '## Context\nWhy',
    })
  })

  it('falls back when the frontmatter is missing, partial, or invalid', () => {
    expect(parsePlan('## Context\nWhy')).toEqual({
      name: 'Plan',
      overview: '',
      body: '## Context\nWhy',
    })
    expect(parsePlan('---\noverview: Only this\n---\nBody')).toEqual({
      name: 'Plan',
      overview: 'Only this',
      body: 'Body',
    })
    expect(parsePlan('---\nname: [oops\n---\nBody')).toEqual({
      name: 'Plan',
      overview: '',
      body: 'Body',
    })
  })
})
