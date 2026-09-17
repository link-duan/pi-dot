import { describe, expect, it } from 'vitest'
import {
  asThinkingLevel,
  isAgentMessage,
  parseThinkingLevels,
  THINKING_LEVEL_LABELS,
} from './protocol'

describe('isAgentMessage', () => {
  it('accepts known roles', () => {
    expect(isAgentMessage({ role: 'user', content: 'hi', timestamp: 1 })).toBe(true)
  })

  it('rejects unknown roles', () => {
    expect(isAgentMessage({ role: 'system' })).toBe(false)
    expect(isAgentMessage(null)).toBe(false)
  })
})

describe('thinking levels', () => {
  it('accepts known levels and drops unknown values', () => {
    expect(asThinkingLevel('high')).toBe('high')
    expect(asThinkingLevel('max')).toBe('max')
    expect(asThinkingLevel('turbo')).toBeUndefined()
    expect(asThinkingLevel(null)).toBeUndefined()
  })

  it('keeps only levels the current model actually exposes', () => {
    expect(parseThinkingLevels(['off', 'high', 'nope', 'max'])).toEqual(['off', 'high', 'max'])
    expect(parseThinkingLevels([])).toEqual(['off'])
    expect(parseThinkingLevels(undefined)).toEqual(['off'])
  })

  it('uses short labels for the trigger', () => {
    expect(THINKING_LEVEL_LABELS.minimal).toBe('Min')
    expect(THINKING_LEVEL_LABELS.medium).toBe('Med')
    expect(THINKING_LEVEL_LABELS.xhigh).toBe('xHigh')
  })
})
