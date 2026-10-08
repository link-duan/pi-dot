import { describe, expect, it } from 'vitest'
import { cleanTitle } from './session-title'

describe('cleanTitle', () => {
  it('takes the first non-empty line and strips decorations', () => {
    expect(cleanTitle('\n  "Fix login redirect."\nmore')).toBe('Fix login redirect')
    expect(cleanTitle('# Title: Refactor queue')).toBe('Refactor queue')
    expect(cleanTitle('「修复滚动条抖动」。')).toBe('修复滚动条抖动')
  })

  it('returns undefined for empty output', () => {
    expect(cleanTitle('')).toBeUndefined()
    expect(cleanTitle('  ""  ')).toBeUndefined()
  })

  it('truncates long titles', () => {
    const title = cleanTitle('x'.repeat(100))
    expect(title).toHaveLength(60)
    expect(title?.endsWith('…')).toBe(true)
  })
})
