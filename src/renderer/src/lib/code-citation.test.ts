import { describe, expect, it } from 'vitest'
import { citationLabel, languageFromPath, parseCodeCitation } from './code-citation'

describe('parseCodeCitation', () => {
  it('parses start:end:path', () => {
    expect(parseCodeCitation('23:74:src/renderer/src/components/ChatPage.tsx')).toEqual({
      start: 23,
      end: 74,
      path: 'src/renderer/src/components/ChatPage.tsx',
    })
  })

  it('keeps the rest of the info string as path so colons survive', () => {
    expect(parseCodeCitation('1:2:C:\\Users\\me\\app.ts')).toEqual({
      start: 1,
      end: 2,
      path: 'C:\\Users\\me\\app.ts',
    })
  })

  it('rejects language tags and inverted ranges', () => {
    expect(parseCodeCitation('tsx')).toBeNull()
    expect(parseCodeCitation('74:23:src/foo.tsx')).toBeNull()
    expect(parseCodeCitation('0:2:src/foo.tsx')).toBeNull()
    expect(parseCodeCitation('1:2:')).toBeNull()
  })
})

describe('languageFromPath', () => {
  it('maps extensions for shiki', () => {
    expect(languageFromPath('src/components/ChatPage.tsx')).toBe('tsx')
    expect(languageFromPath('a.mts')).toBe('ts')
    expect(languageFromPath('a.yml')).toBe('yaml')
    expect(languageFromPath('Dockerfile')).toBe('dockerfile')
    expect(languageFromPath('LICENSE')).toBe('text')
  })
})

describe('citationLabel', () => {
  it('omits the end when the range is a single line', () => {
    expect(citationLabel({ path: 'a.ts', start: 4, end: 4 })).toBe('a.ts:4')
    expect(citationLabel({ path: 'a.ts', start: 4, end: 8 })).toBe('a.ts:4-8')
  })
})
