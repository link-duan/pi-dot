import { describe, expect, it } from 'vitest'
import { highlight } from './highlight'

describe('highlight', () => {
  it('tokenizes typescript', async () => {
    const result = await Promise.resolve(highlight('const n = 1', 'ts'))
    expect(result.tokens.length).toBeGreaterThan(0)
    expect(result.tokens[0]?.some((token) => token.content.includes('const'))).toBe(true)
  })

  it('falls back to text for unknown languages', async () => {
    const result = await Promise.resolve(highlight('hello', 'not-a-lang'))
    expect(result.tokens[0]?.map((token) => token.content).join('')).toBe('hello')
  })

  it('returns the same thenable for the same source', async () => {
    const first = highlight('export const x = 1', 'ts')
    expect(highlight('export const x = 1', 'ts')).toBe(first)
    expect((await first).tokens.length).toBeGreaterThan(0)
  })
})
