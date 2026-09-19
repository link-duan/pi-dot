import { describe, expect, it } from 'vitest'
import { atQuery } from './at-query'

describe('atQuery', () => {
  it('reads an @ token at the start', () => {
    expect(atQuery('@')).toBe('')
    expect(atQuery('@Comp')).toBe('Comp')
    expect(atQuery('@src/foo.ts')).toBe('src/foo.ts')
  })

  it('reads an @ token after whitespace', () => {
    expect(atQuery('see @')).toBe('')
    expect(atQuery('see @Composer')).toBe('Composer')
  })

  it('ignores an @ that is not at the start of a token', () => {
    expect(atQuery('user@host')).toBeNull()
    expect(atQuery('foo@bar.ts')).toBeNull()
  })

  it('ignores a completed token after space', () => {
    expect(atQuery('@foo more')).toBeNull()
    expect(atQuery('see @foo ')).toBeNull()
  })
})
