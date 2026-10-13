import { describe, expect, it } from 'vitest'
import { enabledModelPatterns, resolveEnabledModels } from './settings'

const sonnet = { provider: 'anthropic', id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' }
const datedSonnet = { provider: 'anthropic', id: 'claude-sonnet-4-5-20250929' }
const deepseek = { provider: 'deepseek', id: 'deepseek-chat' }
const routed = { provider: 'openrouter', id: 'deepseek/deepseek-chat' }
const models = [sonnet, datedSonnet, deepseek, routed]

const resolve = (patterns: string[]): string[] => [...resolveEnabledModels(patterns, models)].sort()

describe('resolveEnabledModels', () => {
  it('matches provider/id or a bare id, ignoring case and a thinking suffix', () => {
    expect(resolve(['Anthropic/Claude-Sonnet-4-5'])).toEqual(['anthropic/claude-sonnet-4-5'])
    expect(resolve(['claude-sonnet-4-5:high'])).toEqual(['anthropic/claude-sonnet-4-5'])
    expect(resolve(['openai/gpt-5'])).toEqual([])
  })

  it('prefers a provider/id match over a bare id that looks the same', () => {
    expect(resolve(['deepseek/deepseek-chat'])).toEqual(['deepseek/deepseek-chat'])
    expect(resolve(['openrouter/deepseek/deepseek-chat'])).toEqual([
      'openrouter/deepseek/deepseek-chat',
    ])
  })

  it('falls back to one substring match on id or name, preferring aliases', () => {
    expect(resolve(['sonnet'])).toEqual(['anthropic/claude-sonnet-4-5'])
    expect(resolve(['Sonnet 4.5'])).toEqual(['anthropic/claude-sonnet-4-5'])
  })

  it('supports globs whose * stops at a slash', () => {
    expect(resolve(['anthropic/*'])).toEqual([
      'anthropic/claude-sonnet-4-5',
      'anthropic/claude-sonnet-4-5-20250929',
    ])
    expect(resolve(['*sonnet*:high'])).toEqual([
      'anthropic/claude-sonnet-4-5',
      'anthropic/claude-sonnet-4-5-20250929',
    ])
    expect(resolve(['deepseek/*'])).toEqual([
      'deepseek/deepseek-chat',
      'openrouter/deepseek/deepseek-chat',
    ])
    expect(resolve(['openrouter/*'])).toEqual([])
  })
})

describe('enabledModelPatterns', () => {
  const all = new Set(models.map((model) => `${model.provider}/${model.id}`))
  const without = (...keys: string[]) => new Set([...all].filter((key) => !keys.includes(key)))

  it('clears the patterns when every model is visible', () => {
    expect(enabledModelPatterns(['anthropic/*'], models, all)).toBeNull()
  })

  it('collapses a fully visible provider to provider/*', () => {
    expect(enabledModelPatterns(null, models, without('deepseek/deepseek-chat'))).toEqual([
      'anthropic/*',
      'openrouter/deepseek/deepseek-chat',
    ])
  })

  it('lists models when provider/* would also pick up another provider', () => {
    const patterns = enabledModelPatterns(
      null,
      models,
      without('openrouter/deepseek/deepseek-chat'),
    )
    expect(patterns).toEqual(['anthropic/*', 'deepseek/deepseek-chat'])
    expect([...resolveEnabledModels(patterns!, models)].sort()).toEqual([
      'anthropic/claude-sonnet-4-5',
      'anthropic/claude-sonnet-4-5-20250929',
      'deepseek/deepseek-chat',
    ])
  })

  it('keeps patterns for models that are not available now', () => {
    expect(
      enabledModelPatterns(
        ['gone/model', 'anthropic/*'],
        models,
        without('deepseek/deepseek-chat'),
      ),
    ).toEqual(['gone/model', 'anthropic/*', 'openrouter/deepseek/deepseek-chat'])
  })
})
