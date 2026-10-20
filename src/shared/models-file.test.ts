import { describe, expect, it } from 'vitest'
import {
  applyModelForm,
  applyProviderForm,
  insertModel,
  insertProvider,
  parseModelsFile,
  patchModelForm,
  patchProviderForm,
  readModelForm,
  readProviderForm,
  removeModel,
  removeProvider,
  stringifyModelsFile,
} from './models-file'

const sample = `{
  "providers": {
    "deepseek": {
      "baseUrl": "https://api.deepseek.com",
      "api": "openai-completions",
      "apiKey": "$DEEPSEEK_API_KEY",
      "compat": { "thinkingFormat": "deepseek" },
      "models": [
        {
          "id": "deepseek-v4-pro",
          "reasoning": true,
          "compat": { "thinkingFormat": "deepseek" }
        }
      ]
    }
  }
}`

const commented = `{
  // custom gateway
  "providers": {
    "my-gateway": {
      "api": "openai-responses",
      "models": [
        { "id": "my-model" },
      ],
    },
    // keep this provider
    "ollama": {
      "baseUrl": "http://localhost:11434/v1"
    },
  },
}`

describe('parseModelsFile', () => {
  it('parses providers and treats an empty file as no providers', () => {
    expect(parseModelsFile('')).toEqual({ ok: true, value: { providers: {} } })
    const parsed = parseModelsFile(sample)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(Object.keys(parsed.value.providers)).toEqual(['deepseek'])
  })

  it('rejects invalid JSON and a non-object providers field', () => {
    expect(parseModelsFile('{').ok).toBe(false)
    expect(parseModelsFile('{"providers":[]}').ok).toBe(false)
  })

  it('parses JSONC with comments and trailing commas, matching Pi', () => {
    const parsed = parseModelsFile(commented)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(Object.keys(parsed.value.providers)).toEqual(['my-gateway', 'ollama'])
      expect(parsed.value.providers['my-gateway']?.api).toBe('openai-responses')
    }
  })
})

describe('form round-trip', () => {
  it('keeps compat when editing provider fields', () => {
    const parsed = parseModelsFile(sample)
    if (!parsed.ok) throw new Error(parsed.error)
    const current = parsed.value.providers.deepseek
    const next = applyProviderForm(current, {
      ...readProviderForm(current),
      baseUrl: 'https://example.com',
    })
    expect(next.baseUrl).toBe('https://example.com')
    expect(next.compat).toEqual({ thinkingFormat: 'deepseek' })
    expect(next.apiKey).toBe('$DEEPSEEK_API_KEY')
  })

  it('keeps model compat and updates thinking map without dropping extras', () => {
    const parsed = parseModelsFile(sample)
    if (!parsed.ok) throw new Error(parsed.error)
    const model = (parsed.value.providers.deepseek.models as Array<Record<string, unknown>>)[0]
    const next = applyModelForm(model, {
      ...readModelForm(model),
      name: 'V4 Pro',
      thinkingLevelMap: { high: 'high', max: null },
    })
    expect(next.name).toBe('V4 Pro')
    expect(next.compat).toEqual({ thinkingFormat: 'deepseek' })
    expect(next.thinkingLevelMap).toEqual({ high: 'high', max: null })
    expect(next.input).toBeUndefined()
  })

  it('only writes input when image support changes', () => {
    const parsed = parseModelsFile(sample)
    if (!parsed.ok) throw new Error(parsed.error)
    const model = (parsed.value.providers.deepseek.models as Array<Record<string, unknown>>)[0]
    const enabled = applyModelForm(model, { ...readModelForm(model), image: true })
    expect(enabled.input).toEqual(['text', 'image'])
    const disabled = applyModelForm(enabled, { ...readModelForm(enabled), image: false })
    expect(disabled.input).toEqual(['text'])
  })
})

describe('jsonc edits', () => {
  it('patches a provider field without dropping comments or sibling providers', () => {
    const next = patchProviderForm(commented, 'my-gateway', {
      name: '',
      baseUrl: 'https://example.com',
      api: 'openai-responses',
      apiKey: '',
      authHeader: false,
      headers: [],
    })
    expect(next).toContain('// custom gateway')
    expect(next).toContain('// keep this provider')
    expect(next).toContain('"ollama"')
    const parsed = parseModelsFile(next)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.providers['my-gateway']?.baseUrl).toBe('https://example.com')
  })

  it('adds, replaces, and deletes providers and models in text', () => {
    let text = insertProvider('', 'ollama', { baseUrl: 'http://localhost:11434/v1' })
    text = insertModel(text, 'ollama', { id: 'llama' })
    let parsed = parseModelsFile(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.providers.ollama.models).toEqual([{ id: 'llama' }])
    text = patchModelForm(text, 'ollama', 'llama', {
      ...readModelForm({ id: 'llama' }),
      name: 'Llama',
    })
    parsed = parseModelsFile(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect((parsed.value.providers.ollama.models as Array<Record<string, unknown>>)[0]).toEqual({
        id: 'llama',
        name: 'Llama',
      })
    }
    text = removeModel(text, 'ollama', 'llama')
    parsed = parseModelsFile(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.providers.ollama.models).toEqual([])
    text = removeProvider(text, 'ollama')
    parsed = parseModelsFile(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.providers).toEqual({})
  })
})

describe('json view', () => {
  it('pretty-prints', () => {
    const text = stringifyModelsFile({ providers: { ollama: { api: 'openai-completions' } } })
    expect(text.startsWith('{\n  "providers"')).toBe(true)
  })
})
