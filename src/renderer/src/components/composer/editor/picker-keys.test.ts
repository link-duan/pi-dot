import { describe, expect, it } from 'vitest'
import { stepIndex } from './picker-keys'

describe('stepIndex', () => {
  it('wraps around a non-empty list', () => {
    expect(stepIndex({ query: 'a', index: 0 }, 3, -1).index).toBe(2)
    expect(stepIndex({ query: 'a', index: 2 }, 3, 1).index).toBe(0)
  })

  it('stays put when empty', () => {
    expect(stepIndex({ query: 'a', index: 0 }, 0, 1)).toEqual({ query: 'a', index: 0 })
  })
})
