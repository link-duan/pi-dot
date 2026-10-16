import { describe, expect, it } from 'vitest'
import { fileUrlToPath } from './clipboard-paths'

describe('fileUrlToPath', () => {
  it('decodes a posix file URL', () => {
    expect(fileUrlToPath('file:///Users/me/a.ts')).toBe('/Users/me/a.ts')
    expect(fileUrlToPath('file:///tmp/foo%20bar.png')).toBe('/tmp/foo bar.png')
  })

  it('strips the extra slash on Windows paths', () => {
    expect(fileUrlToPath('file:///C:/Users/me/a.ts')).toBe('C:/Users/me/a.ts')
  })

  it('rejects non-file URLs', () => {
    expect(fileUrlToPath('https://example.com/a.ts')).toBeNull()
    expect(fileUrlToPath('not a url')).toBeNull()
  })
})
