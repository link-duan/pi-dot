import { describe, expect, it } from 'vitest'
import { displayPath, isImageFile, tokenPath } from './path'

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

  it('shows the home-prefixed absolute path when cwd is omitted', () => {
    expect(displayPath('/Users/me/Documents/pi-ui', null, home)).toBe('~/Documents/pi-ui')
    expect(displayPath('/Users/me', null, home)).toBe('~')
    expect(displayPath('/tmp/proj', null, home)).toBe('/tmp/proj')
  })

  it('picks the shorter form when outside cwd', () => {
    expect(displayPath('/tmp/notes.md', '/Users/me/Documents/pi-ui', home)).toBe('/tmp/notes.md')
    expect(displayPath('/tmp/proj/src/a.ts', '/tmp/proj/nested', home)).toBe('../src/a.ts')
  })
})

describe('tokenPath', () => {
  const home = '/Users/me'
  const cwd = '/Users/me/proj'

  it('keeps cwd files relative without ./', () => {
    expect(tokenPath('/Users/me/proj/src/a.tsx', cwd, home)).toBe('src/a.tsx')
    expect(tokenPath('/Users/me/proj', cwd, home)).toBe('.')
  })

  it('uses ~/ or absolute outside cwd, never ../', () => {
    expect(tokenPath('/Users/me/.zshrc', cwd, home)).toBe('~/.zshrc')
    expect(tokenPath('/tmp/shot.png', cwd, home)).toBe('/tmp/shot.png')
    expect(tokenPath('/tmp/proj/src/a.ts', '/tmp/proj/nested', home)).toBe('/tmp/proj/src/a.ts')
  })

  it('adds a trailing slash for directories', () => {
    expect(tokenPath('/Users/me/proj/src/components', cwd, home, true)).toBe('src/components/')
    expect(tokenPath('/Users/me/Desktop', cwd, home, true)).toBe('~/Desktop/')
  })
})

describe('isImageFile', () => {
  it('identifies image file extensions', () => {
    expect(isImageFile('photo.png')).toBe(true)
    expect(isImageFile('photo.jpg')).toBe(true)
    expect(isImageFile('photo.jpeg')).toBe(true)
    expect(isImageFile('photo.webp')).toBe(true)
    expect(isImageFile('photo.gif')).toBe(true)
    expect(isImageFile('photo.bmp')).toBe(true)
    expect(isImageFile('photo.svg')).toBe(true)
    expect(isImageFile('photo.ico')).toBe(true)
  })

  it('handles line range suffixes', () => {
    expect(isImageFile('photo.png:1:20')).toBe(true)
    expect(isImageFile('screenshot.jpg:10')).toBe(true)
  })

  it('rejects non-image files and falsy paths', () => {
    expect(isImageFile('code.ts')).toBe(false)
    expect(isImageFile('code.ts:1:20')).toBe(false)
    expect(isImageFile(null)).toBe(false)
    expect(isImageFile('')).toBe(false)
    expect(isImageFile(undefined)).toBe(false)
  })
})
