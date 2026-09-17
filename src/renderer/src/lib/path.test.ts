import { describe, expect, it } from 'vitest'
import { displayPath } from './path'

describe('displayPath', () => {
  const home = '/Users/me'

  it('keeps paths inside cwd relative', () => {
    expect(displayPath('/Users/me/proj/src/a.tsx', '/Users/me/proj', home)).toBe('src/a.tsx')
    expect(displayPath('/Users/me/proj', '/Users/me/proj', home)).toBe('.')
  })

  it('uses ~/ for home-prefixed absolute paths', () => {
    expect(displayPath('/Users/me/.zshrc', '/Users/me/proj', home)).toBe('~/.zshrc')
    expect(displayPath('/Users/me', '/tmp', home)).toBe('~')
  })

  it('picks the shorter form when outside cwd', () => {
    expect(displayPath('/tmp/notes.md', '/Users/me/Documents/pi-ui', home)).toBe('/tmp/notes.md')
    expect(displayPath('/tmp/proj/src/a.ts', '/tmp/proj/nested', home)).toBe('../src/a.ts')
  })
})
