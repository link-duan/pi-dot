import { applyEdits, modify, type JSONPath } from 'jsonc-parser'

export type JsonObject = Record<string, unknown>

export const PROVIDER_APIS = [
  'openai-completions',
  'openai-responses',
  'anthropic-messages',
  'google-generative-ai',
] as const

export type ProviderApi = (typeof PROVIDER_APIS)[number]

export interface ModelsFile extends JsonObject {
  providers: Record<string, JsonObject>
}

export type ParseResult = { ok: true; value: ModelsFile } | { ok: false; error: string }

/** Same as Pi: strip `//` comments and trailing commas, leaving string literals untouched. */
export function stripJsonComments(input: string): string {
  return input
    .replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*/g, (match) => (match[0] === '"' ? match : ''))
    .replace(
      /"(?:\\.|[^"\\])*"|,(\s*[}\]])/g,
      (match, tail: string | undefined) => tail ?? (match[0] === '"' ? match : ''),
    )
}

function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
}

export function parseModelsFile(text: string): ParseResult {
  const trimmed = stripBom(text).trim()
  if (!trimmed) return { ok: true, value: { providers: {} } }
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(trimmed))
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'models.json must be an object' }
  }
  const record = parsed as JsonObject
  if (record.providers === undefined) return { ok: true, value: { ...record, providers: {} } }
  if (!isPlainObject(record.providers)) {
    return { ok: false, error: 'providers must be an object' }
  }
  return { ok: true, value: record as ModelsFile }
}

export function stringifyModelsFile(file: ModelsFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}

export function isPlainObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function providerModels(provider: JsonObject): JsonObject[] {
  return Array.isArray(provider.models) ? provider.models.filter(isPlainObject) : []
}

export function modelId(model: JsonObject): string {
  return typeof model.id === 'string' ? model.id : ''
}

export interface ProviderForm {
  name: string
  baseUrl: string
  api: string
  apiKey: string
  authHeader: boolean
  headers: Array<{ key: string; value: string }>
}

export function readProviderForm(provider: JsonObject): ProviderForm {
  const headers = isPlainObject(provider.headers)
    ? Object.entries(provider.headers).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? value : String(value ?? ''),
      }))
    : []
  return {
    name: asString(provider.name),
    baseUrl: asString(provider.baseUrl),
    api: asString(provider.api),
    apiKey: asString(provider.apiKey),
    authHeader: provider.authHeader === true,
    headers,
  }
}

export function applyProviderForm(provider: JsonObject, form: ProviderForm): JsonObject {
  const next: JsonObject = { ...provider }
  setOptionalString(next, 'name', form.name)
  setOptionalString(next, 'baseUrl', form.baseUrl)
  setOptionalString(next, 'api', form.api)
  setOptionalString(next, 'apiKey', form.apiKey)
  if (form.authHeader) next.authHeader = true
  else delete next.authHeader
  const headers = Object.fromEntries(
    form.headers.filter((row) => row.key.trim()).map((row) => [row.key, row.value]),
  )
  if (Object.keys(headers).length > 0) next.headers = headers
  else delete next.headers
  return next
}

export interface ModelForm {
  id: string
  name: string
  reasoning: boolean
  image: boolean
  contextWindow: string
  maxTokens: string
  costInput: string
  costOutput: string
  costCacheRead: string
  costCacheWrite: string
  thinkingLevelMap: Record<string, string | null | undefined>
}

const EMPTY_MAP: Record<string, string | null | undefined> = {}

export function readModelForm(model: JsonObject): ModelForm {
  const input = Array.isArray(model.input) ? model.input : []
  const cost = isPlainObject(model.cost) ? model.cost : null
  const map = isPlainObject(model.thinkingLevelMap) ? model.thinkingLevelMap : EMPTY_MAP
  return {
    id: asString(model.id),
    name: asString(model.name),
    reasoning: model.reasoning === true,
    image: input.includes('image'),
    contextWindow: numberField(model.contextWindow),
    maxTokens: numberField(model.maxTokens),
    costInput: numberField(cost?.input),
    costOutput: numberField(cost?.output),
    costCacheRead: numberField(cost?.cacheRead),
    costCacheWrite: numberField(cost?.cacheWrite),
    thinkingLevelMap: {
      off: mapValue(map.off),
      minimal: mapValue(map.minimal),
      low: mapValue(map.low),
      medium: mapValue(map.medium),
      high: mapValue(map.high),
      xhigh: mapValue(map.xhigh),
      max: mapValue(map.max),
    },
  }
}

export function applyModelForm(model: JsonObject, form: ModelForm): JsonObject {
  const next: JsonObject = { ...model }
  next.id = form.id
  setOptionalString(next, 'name', form.name)
  if (form.reasoning) next.reasoning = true
  else delete next.reasoning
  applyImageInput(next, model, form.image)
  setOptionalNumber(next, 'contextWindow', form.contextWindow)
  setOptionalNumber(next, 'maxTokens', form.maxTokens)

  const cost = {
    ...(isPlainObject(next.cost) ? next.cost : {}),
  }
  setOptionalNumber(cost, 'input', form.costInput)
  setOptionalNumber(cost, 'output', form.costOutput)
  setOptionalNumber(cost, 'cacheRead', form.costCacheRead)
  setOptionalNumber(cost, 'cacheWrite', form.costCacheWrite)
  const costKeys = ['input', 'output', 'cacheRead', 'cacheWrite'].filter((key) => key in cost)
  if (costKeys.length > 0) next.cost = cost
  else delete next.cost

  const map: Record<string, string | null> = {}
  for (const [level, value] of Object.entries(form.thinkingLevelMap)) {
    if (value === undefined) continue
    map[level] = value
  }
  if (Object.keys(map).length > 0) next.thinkingLevelMap = map
  else delete next.thinkingLevelMap
  return next
}

const JSONC_FORMAT = {
  formattingOptions: { tabSize: 2, insertSpaces: true, eol: '\n' },
}

const EMPTY_MODELS_FILE = '{\n  "providers": {}\n}\n'

const PROVIDER_FORM_KEYS = ['name', 'baseUrl', 'api', 'apiKey', 'authHeader', 'headers'] as const
const MODEL_FORM_KEYS = [
  'id',
  'name',
  'reasoning',
  'input',
  'contextWindow',
  'maxTokens',
  'cost',
  'thinkingLevelMap',
] as const

export function setJsoncPath(text: string, path: JSONPath, value: unknown): string {
  const source = text.trim() ? text : EMPTY_MODELS_FILE
  return applyEdits(source, modify(source, path, value, JSONC_FORMAT))
}

export function insertProvider(
  text: string,
  id: string,
  provider: JsonObject = { models: [] },
): string {
  return setJsoncPath(text, ['providers', id], provider)
}

export function removeProvider(text: string, id: string): string {
  return setJsoncPath(text, ['providers', id], undefined)
}

export function insertModel(text: string, providerId: string, model: JsonObject): string {
  const parsed = parseModelsFile(text)
  if (!parsed.ok) return text
  const current = parsed.value.providers[providerId]
  if (!current) return text
  const models = providerModels(current)
  if (!Array.isArray(current.models)) {
    return setJsoncPath(text, ['providers', providerId, 'models'], [model])
  }
  return applyEdits(
    text,
    modify(text, ['providers', providerId, 'models', models.length], model, {
      ...JSONC_FORMAT,
      isArrayInsertion: true,
    }),
  )
}

export function removeModel(text: string, providerId: string, id: string): string {
  const parsed = parseModelsFile(text)
  if (!parsed.ok) return text
  const index = providerModels(parsed.value.providers[providerId] ?? {}).findIndex(
    (item) => modelId(item) === id,
  )
  if (index < 0) return text
  return setJsoncPath(text, ['providers', providerId, 'models', index], undefined)
}

export function patchProviderForm(text: string, id: string, form: ProviderForm): string {
  const parsed = parseModelsFile(text)
  if (!parsed.ok) return text
  const current = parsed.value.providers[id]
  if (!current) return text
  return patchFields(
    text,
    ['providers', id],
    current,
    applyProviderForm(current, form),
    PROVIDER_FORM_KEYS,
  )
}

export function patchModelForm(
  text: string,
  providerId: string,
  previousId: string,
  form: ModelForm,
): string {
  const parsed = parseModelsFile(text)
  if (!parsed.ok) return text
  const models = providerModels(parsed.value.providers[providerId] ?? {})
  const index = models.findIndex((item) => modelId(item) === previousId)
  const current = models[index]
  if (!current) return text
  return patchFields(
    text,
    ['providers', providerId, 'models', index],
    current,
    applyModelForm(current, form),
    MODEL_FORM_KEYS,
  )
}

function applyImageInput(next: JsonObject, model: JsonObject, image: boolean): void {
  const current = Array.isArray(model.input) ? model.input : null
  const hadImage = !!current?.includes('image')
  if (image === hadImage) return
  if (image) {
    const input = current ? [...current] : ['text']
    if (!input.includes('text')) input.unshift('text')
    if (!input.includes('image')) input.push('image')
    next.input = input
    return
  }
  if (!current) return
  const input = current.filter((item) => item !== 'image')
  next.input = input.length > 0 ? input : ['text']
}

function patchFields(
  text: string,
  path: JSONPath,
  previous: JsonObject,
  next: JsonObject,
  keys: readonly string[],
): string {
  let out = text
  for (const key of keys) {
    const hasPrev = Object.prototype.hasOwnProperty.call(previous, key)
    const hasNext = Object.prototype.hasOwnProperty.call(next, key)
    if (!hasPrev && !hasNext) continue
    if (hasPrev && hasNext && jsonEqual(previous[key], next[key])) continue
    out = setJsoncPath(out, [...path, key], hasNext ? next[key] : undefined)
  }
  return out
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function numberField(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function mapValue(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return typeof value === 'string' ? value : String(value)
}

function setOptionalString(target: JsonObject, key: string, value: string): void {
  if (value.trim()) target[key] = value
  else delete target[key]
}

function setOptionalNumber(target: JsonObject, key: string, value: string): void {
  const trimmed = value.trim()
  if (!trimmed) {
    delete target[key]
    return
  }
  const parsed = Number(trimmed)
  if (Number.isFinite(parsed)) target[key] = parsed
}
