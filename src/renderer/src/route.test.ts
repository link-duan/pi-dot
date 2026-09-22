import { describe, expect, it } from 'vitest'
import { parseSection, settingsPath } from './route'

describe('settingsPath', () => {
  it('encodes the section as a query param', () => {
    expect(settingsPath('providers')).toBe('/settings?section=providers')
  })
})

describe('parseSection', () => {
  it('accepts known sections only', () => {
    expect(parseSection('general')).toBe('general')
    expect(parseSection(null)).toBe('general')
    expect(parseSection('nope')).toBe('general')
  })
})
