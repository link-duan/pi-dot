import { describe, expect, it } from 'vitest'
import { resolveImagePath } from './image-preview'

describe('resolveImagePath', () => {
  it('resolves relative, home and absolute chip paths', () => {
    expect(resolveImagePath('docs/a.png', '/repo', '/Users/me')).toBe('/repo/docs/a.png')
    expect(resolveImagePath('~/Desktop/a.JPG', '/repo', '/Users/me')).toBe(
      '/Users/me/Desktop/a.JPG',
    )
    expect(resolveImagePath('/tmp/a.webp', undefined, '/Users/me')).toBe('/tmp/a.webp')
  })

  it('rejects non-images and relative paths without a cwd', () => {
    expect(resolveImagePath('src/a.ts', '/repo', '/Users/me')).toBeNull()
    expect(resolveImagePath('a.png', undefined, '/Users/me')).toBeNull()
  })
})
