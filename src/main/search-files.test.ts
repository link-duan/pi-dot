import { describe, expect, it } from 'vitest'
import { rankFileHits, scoreFileHit, walkScope } from './search-files'

describe('scoreFileHit', () => {
  it('prefers an exact basename, then prefix, then path', () => {
    expect(scoreFileHit('src/Composer.tsx', 'composer.tsx', false)).toBe(100)
    expect(scoreFileHit('src/Composer.tsx', 'comp', false)).toBe(80)
    expect(scoreFileHit('src/Composer.tsx', 'poser', false)).toBe(50)
    expect(scoreFileHit('src/Composer.tsx', 'src/', false)).toBe(30)
  })

  it('boosts directories that already match', () => {
    expect(scoreFileHit('src/components', 'comp', true)).toBe(90)
    expect(scoreFileHit('src/components', 'nope', true)).toBe(0)
  })
})

describe('rankFileHits', () => {
  it('uses the segment after the last slash as the needle', () => {
    const ranked = rankFileHits(
      [
        { path: 'src/components/Composer.tsx', isDirectory: false },
        { path: 'src/components', isDirectory: true },
        { path: 'src/chat/store.ts', isDirectory: false },
      ],
      'src/comp',
    )
    expect(ranked.map((hit) => hit.path)).toEqual(['src/components', 'src/components/Composer.tsx'])
  })

  it('caps visible hits at 20', () => {
    const hits = Array.from({ length: 40 }, (_, i) => ({
      path: `src/f${String(i).padStart(2, '0')}.ts`,
      isDirectory: false,
    }))
    expect(rankFileHits(hits, '').length).toBe(20)
  })
})

describe('walkScope', () => {
  it('keeps everything without a prefix', () => {
    expect(walkScope('chat', false, '')).toBe('keep')
  })

  it('keeps entries inside @src/ and skips siblings', () => {
    expect(walkScope('src', true, 'src/')).toBe('keep')
    expect(walkScope('src/a.ts', false, 'src/')).toBe('keep')
    expect(walkScope('chat', true, 'src/')).toBe('skip')
  })

  it('descends ancestor directories of a nested prefix', () => {
    expect(walkScope('src', true, 'src/foo/')).toBe('descend')
    expect(walkScope('src/foo', true, 'src/foo/')).toBe('keep')
  })
})
