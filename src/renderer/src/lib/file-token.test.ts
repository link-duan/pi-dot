import { describe, expect, it } from 'vitest'
import {
  fileChipLabel,
  isClipboardImage,
  formatFileToken,
  matchFileTokens,
  peelRange,
} from './file-token'

describe('formatFileToken', () => {
  it('serializes a relative file', () => {
    expect(formatFileToken({ path: 'src/Composer.tsx' })).toBe('@file:src/Composer.tsx')
  })

  it('quotes whitespace', () => {
    expect(formatFileToken({ path: 'foo bar.ts' })).toBe('@file:"foo bar.ts"')
  })

  it('keeps a directory slash', () => {
    expect(formatFileToken({ path: 'src/components/' })).toBe('@file:src/components/')
  })

  it('appends a 1-based range', () => {
    expect(formatFileToken({ path: 'src/foo.ts', range: { start: 10 } })).toBe(
      '@file:src/foo.ts:10',
    )
    expect(formatFileToken({ path: 'src/foo.ts', range: { start: 10, end: 20 } })).toBe(
      '@file:src/foo.ts:10-20',
    )
  })

  it('puts quotes outside the range', () => {
    expect(formatFileToken({ path: 'foo bar.ts', range: { start: 10, end: 20 } })).toBe(
      '@file:"foo bar.ts":10-20',
    )
  })

  it('drops ranges on directories and images', () => {
    expect(formatFileToken({ path: 'src/components/', range: { start: 10 } })).toBe(
      '@file:src/components/',
    )
    expect(formatFileToken({ path: 'shot.png', range: { start: 1, end: 2 } })).toBe(
      '@file:shot.png',
    )
  })
})

describe('peelRange', () => {
  it('peels :start and :start-end off an unquoted path', () => {
    expect(peelRange('src/foo.ts:10')).toEqual({ path: 'src/foo.ts', range: { start: 10 } })
    expect(peelRange('src/foo.ts:10-20')).toEqual({
      path: 'src/foo.ts',
      range: { start: 10, end: 20 },
    })
  })

  it('leaves a bare path alone', () => {
    expect(peelRange('src/foo.ts')).toEqual({ path: 'src/foo.ts' })
    expect(peelRange('src/components/')).toEqual({ path: 'src/components/' })
  })

  it('drops ranges on directories and images', () => {
    expect(peelRange('src/components/:10')).toEqual({ path: 'src/components/' })
    expect(peelRange('a.png:3-4')).toEqual({ path: 'a.png' })
  })
})

describe('matchFileTokens', () => {
  it('ignores a bare @path', () => {
    expect(matchFileTokens('look at @src/foo.ts and @john')).toEqual([])
  })

  it('finds mixed quoted, ranged, and directory tokens', () => {
    const text = 'see @file:src/foo.ts:10-20 and @file:"foo bar.ts" plus @file:src/components/'
    expect(matchFileTokens(text).map((item) => item.ref)).toEqual([
      { path: 'src/foo.ts', range: { start: 10, end: 20 } },
      { path: 'foo bar.ts' },
      { path: 'src/components/' },
    ])
  })

  it('keeps home and tmp paths', () => {
    expect(matchFileTokens('@file:~/Desktop/a.png')[0]?.ref).toEqual({ path: '~/Desktop/a.png' })
    expect(matchFileTokens('@file:/tmp/pi-ui-clipboard-1.png')[0]?.ref).toEqual({
      path: '/tmp/pi-ui-clipboard-1.png',
    })
  })
})

describe('fileChipLabel', () => {
  it('uses the basename and appends a range', () => {
    expect(fileChipLabel('src/components/Composer.tsx')).toBe('Composer.tsx')
    expect(fileChipLabel('src/foo.ts', { start: 10, end: 20 })).toBe('foo.ts:10-20')
    expect(fileChipLabel('src/foo.ts', { start: 10 })).toBe('foo.ts:10')
  })

  it('keeps a trailing slash on directories', () => {
    expect(fileChipLabel('src/components/')).toBe('components/')
    expect(fileChipLabel('~/Desktop/a.png')).toBe('a.png')
  })

  it('recognizes pasted screenshot paths', () => {
    expect(isClipboardImage('/var/folders/T/pi-ui-clipboard-4213-a4a5.png')).toBe(true)
    expect(isClipboardImage('docs/pi-ui-clipboard.png')).toBe(false)
  })

  it('names pasted screenshots and shortens long names in the middle', () => {
    expect(fileChipLabel('/tmp/pi-ui-clipboard-970b019c-ed1c-42d1-8f48-10c918d546cd.png')).toBe(
      'Image',
    )
    expect(fileChipLabel('docs/very-long-file-name-for-the-logo.png')).toBe(
      'very-long-file-n…e-logo.png',
    )
    expect(fileChipLabel('src/a-really-long-component-name.tsx', { start: 3 })).toBe(
      'a-really-long-co…t-name.tsx:3',
    )
  })
})
