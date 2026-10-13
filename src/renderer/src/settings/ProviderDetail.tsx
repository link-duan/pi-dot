import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import {
  modelId,
  PROVIDER_APIS,
  providerModels,
  readModelForm,
  readProviderForm,
  type JsonObject,
  type ModelForm,
  type ProviderForm,
} from '@shared/models-file'
import { THINKING_LEVELS, type ModelInfo } from '@shared/protocol'
import {
  describeAuth,
  type ProviderAuthMethod,
  type ProviderListItem,
  type ProviderTestResult,
} from '@shared/settings'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  SettingBadge,
  SettingCard,
  SettingRow,
  SettingSection,
  StatusDot,
} from './components/SettingCard'
import { LabeledSelectValue } from './fields'

export function DeleteAction({
  pending,
  onArm,
  onConfirm,
  onCancel,
}: {
  pending: boolean
  onArm: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  if (pending) {
    return (
      <div className="flex animate-in items-center gap-1.5 duration-150 fade-in">
        <Button type="button" size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="xs" variant="destructive" onClick={onConfirm}>
          Delete
        </Button>
      </div>
    )
  }
  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      className="text-muted-foreground hover:text-destructive"
      aria-label="Delete"
      onClick={onArm}
    >
      <Trash2 className="size-3.5" />
    </Button>
  )
}

function formatTokens(count: number): string {
  if (count >= 1000000) return `${Math.round(count / 100000) / 10}M`
  if (count >= 1000) return `${Math.round(count / 1000)}k`
  return String(count)
}

function authDot(item: ProviderListItem): 'online' | 'offline' | 'warning' {
  if (item.authSource === 'oauth') return 'online'
  return item.configured ? 'offline' : 'warning'
}

/** Runs a connection test; a result only shows while the provider and `config` it tested are current. */
function useConnectionTest(providerId: string, config: string) {
  const stamp = `${providerId}\n${config}`
  const [last, setLast] = useState<{ stamp: string; result: ProviderTestResult } | null>(null)
  const [testing, setTesting] = useState(false)

  async function run(): Promise<void> {
    const tested = stamp
    setTesting(true)
    setLast(null)
    const result = await window.pi
      .testProvider(providerId)
      .catch((error: unknown): ProviderTestResult => ({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      }))
    setTesting(false)
    setLast({ stamp: tested, result })
  }

  return { result: last?.stamp === stamp ? last.result : null, testing, run }
}

function TestResultText({ result, className }: { result: ProviderTestResult; className?: string }) {
  return (
    <span
      className={cn('block truncate', !result.ok && 'text-destructive', className)}
      title={result.ok ? undefined : result.message}
    >
      {result.ok
        ? `Connected · ${result.latencyMs} ms · ${result.model}`
        : `Connection failed · ${result.message}`}
    </span>
  )
}

function TestButton({
  testing,
  onClick,
  variant = 'outline',
  className,
}: {
  testing: boolean
  onClick: () => void
  variant?: 'outline' | 'ghost'
  className?: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className={className}
      disabled={testing}
      onClick={onClick}
    >
      {testing ? <Spinner className="size-3.5" /> : null}
      {testing ? 'Testing…' : 'Test'}
    </Button>
  )
}

function connectionConfig(form: ProviderForm): string {
  const { baseUrl, api, apiKey, authHeader, headers } = form
  return JSON.stringify({ baseUrl, api, apiKey, authHeader, headers })
}

function ConnectionTest({ providerId, config }: { providerId: string; config: string }) {
  const { result, testing, run } = useConnectionTest(providerId, config)
  return (
    <SettingRow
      title="Connection test"
      description={
        result ? <TestResultText result={result} /> : 'Send a short request with the cheapest model'
      }
    >
      <TestButton testing={testing} onClick={() => void run()} />
    </SettingRow>
  )
}

function ProviderStatusRow({ item, actions }: { item: ProviderListItem; actions: ReactNode }) {
  const { result, testing, run } = useConnectionTest(item.id, item.authSource)
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <StatusDot status={authDot(item)} />
          <span className="truncate">{item.configured ? describeAuth(item) : 'Not connected'}</span>
        </div>
        {result ? (
          <TestResultText result={result} className="pl-3.5 text-xs text-muted-foreground" />
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {item.configured ? (
          <TestButton
            testing={testing}
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => void run()}
          />
        ) : null}
        {actions}
      </div>
    </div>
  )
}

export function BuiltinProvider({
  item,
  models,
  onLogin,
  onLogout,
}: {
  item: ProviderListItem
  models: ModelInfo[]
  onLogin: (login: { id: string; name: string; methods: ProviderAuthMethod[] }) => void
  onLogout: () => void
}) {
  const [pendingLogout, setPendingLogout] = useState(false)

  return (
    <div className="flex flex-col gap-8 pb-12">
      <SettingSection title="Account">
        <SettingCard>
          <ProviderStatusRow
            item={item}
            actions={
              <>
                {item.configured ? (
                  pendingLogout ? (
                    <div className="flex animate-in items-center gap-1.5 duration-150 fade-in">
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => setPendingLogout(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        onClick={() => {
                          setPendingLogout(false)
                          onLogout()
                        }}
                      >
                        Sign out
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingLogout(true)}
                    >
                      Sign out
                    </Button>
                  )
                ) : null}
                {item.methods.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={item.configured ? 'outline' : 'default'}
                    onClick={() => onLogin({ id: item.id, name: item.name, methods: item.methods })}
                  >
                    {item.configured ? 'Reconnect' : 'Connect'}
                  </Button>
                ) : null}
              </>
            }
          />
        </SettingCard>
      </SettingSection>

      <SettingSection
        title="Models"
        description="Choose which ones show in the model picker on the Models page"
      >
        <SettingCard>
          {models.length === 0 ? (
            <div className="px-4 py-5 text-center text-xs text-muted-foreground">
              {item.configured ? 'No models available' : 'Connect to use this provider’s models'}
            </div>
          ) : (
            models.map((model) => (
              <div
                key={model.id}
                className="flex items-baseline gap-2 px-4 py-2.5 text-[13px] text-foreground"
              >
                <span className="truncate">{model.name}</span>
                {model.name !== model.id ? (
                  <span className="truncate text-[11px] text-muted-foreground">{model.id}</span>
                ) : null}
              </div>
            ))
          )}
        </SettingCard>
      </SettingSection>
    </div>
  )
}

export function CustomProviderEditor({
  id,
  provider,
  onChange,
  onAddModel,
  onSelectModel,
}: {
  id: string
  provider: JsonObject
  onChange: (form: ProviderForm) => void
  onAddModel: (id: string) => void
  onSelectModel: (id: string) => void
}) {
  const models = providerModels(provider)
  const [form, setForm] = useState(() => readProviderForm(provider))
  const [reveal, setReveal] = useState(false)

  function commit(next: ProviderForm): void {
    setForm(next)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <SettingSection title="Connection">
        <SettingCard>
          <SettingRow title="Display name">
            <Input
              className="w-72 text-xs"
              value={form.name}
              placeholder={id}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              onBlur={() => commit(form)}
            />
          </SettingRow>
          <SettingRow title="Base URL">
            <Input
              className="w-80 text-xs"
              value={form.baseUrl}
              placeholder="https://api.example.com/v1"
              onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
              onBlur={() => commit(form)}
            />
          </SettingRow>
          <SettingRow title="API protocol">
            <Select
              value={form.api || undefined}
              onValueChange={(value) => value && commit({ ...form, api: value })}
            >
              <SelectTrigger className="w-52">
                <LabeledSelectValue
                  labels={Object.fromEntries(PROVIDER_APIS.map((api) => [api, api]))}
                />
              </SelectTrigger>
              <SelectContent align="end">
                {PROVIDER_APIS.map((api) => (
                  <SelectItem key={api} value={api}>
                    {api}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow title="API key">
            <InputGroup className="w-80">
              <InputGroupInput
                type={reveal ? 'text' : 'password'}
                className="text-xs"
                placeholder="sk-…"
                value={form.apiKey}
                onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                onBlur={() => commit(form)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label={reveal ? 'Hide API key' : 'Show API key'}
                  onClick={() => setReveal((value) => !value)}
                >
                  {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </SettingRow>
          <SettingRow title="Force sending Authorization header">
            <Switch
              checked={form.authHeader}
              onCheckedChange={(authHeader) => commit({ ...form, authHeader })}
            />
          </SettingRow>
          <ConnectionTest providerId={id} config={connectionConfig(form)} />
        </SettingCard>
      </SettingSection>

      <SettingSection
        title="Headers"
        action={
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Add header"
            onClick={() => commit({ ...form, headers: [...form.headers, { key: '', value: '' }] })}
          >
            <Plus className="size-3.5" />
          </Button>
        }
      >
        <SettingCard>
          {form.headers.length === 0 ? (
            <div className="px-4 py-5 text-center text-xs text-muted-foreground">
              No custom headers
            </div>
          ) : (
            form.headers.map((row, index) => (
              <div key={index} className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted/10">
                <Input
                  placeholder="Header"
                  className="flex-1 text-xs"
                  value={row.key}
                  onChange={(event) => {
                    const headers = form.headers.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, key: event.target.value } : item,
                    )
                    setForm({ ...form, headers })
                  }}
                  onBlur={() => commit(form)}
                />
                <Input
                  placeholder="Value"
                  className="flex-1 text-xs"
                  value={row.value}
                  onChange={(event) => {
                    const headers = form.headers.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, value: event.target.value } : item,
                    )
                    setForm({ ...form, headers })
                  }}
                  onBlur={() => commit(form)}
                />
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Remove header"
                  onClick={() =>
                    commit({
                      ...form,
                      headers: form.headers.filter((_, itemIndex) => itemIndex !== index),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </SettingCard>
      </SettingSection>

      <SettingSection
        title="Models"
        action={
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Add model"
            onClick={() => {
              const nextId = `model-${models.length + 1}`
              onAddModel(nextId)
              onSelectModel(nextId)
            }}
          >
            <Plus className="size-3.5" />
          </Button>
        }
      >
        <SettingCard>
          {models.length === 0 ? (
            <div className="px-4 py-5 text-center text-xs text-muted-foreground">
              No models configured
            </div>
          ) : (
            models.map((model) => {
              const mid = modelId(model)
              const name = typeof model.name === 'string' && model.name.trim() ? model.name : mid
              const hasReasoning = model.reasoning === true
              const hasImage = Array.isArray(model.input) && model.input.includes('image')
              const context =
                typeof model.contextWindow === 'number' ? formatTokens(model.contextWindow) : null

              return (
                <button
                  key={mid}
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
                  onClick={() => onSelectModel(mid)}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-foreground">{name}</span>
                    {name !== mid ? (
                      <span className="truncate text-xs text-muted-foreground">{mid}</span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {hasReasoning ? <SettingBadge>Reasoning</SettingBadge> : null}
                    {hasImage ? <SettingBadge>Vision</SettingBadge> : null}
                    {context ? <SettingBadge>{context}</SettingBadge> : null}
                    <ChevronRight className="size-4 text-muted-foreground/60" />
                  </div>
                </button>
              )
            })
          )}
        </SettingCard>
      </SettingSection>
    </div>
  )
}

export function ModelEditor({
  model,
  onChange,
}: {
  model: JsonObject
  onChange: (form: ModelForm, previousId: string) => void
}) {
  const previousId = modelId(model)
  const [form, setForm] = useState(() => readModelForm(model))
  const [advanced, setAdvanced] = useState(false)

  function commit(next: ModelForm): void {
    setForm(next)
    onChange(next, previousId)
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <SettingSection title="Model settings">
        <SettingCard>
          <SettingRow title="Model ID">
            <Input
              className="w-72 text-xs"
              value={form.id}
              onChange={(event) => setForm({ ...form, id: event.target.value })}
              onBlur={() => commit(form)}
            />
          </SettingRow>
          <SettingRow title="Display name">
            <Input
              className="w-72 text-xs"
              value={form.name}
              placeholder={form.id}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              onBlur={() => commit(form)}
            />
          </SettingRow>
          <SettingRow title="Context window">
            <Input
              className="w-36 text-xs"
              value={form.contextWindow}
              placeholder="128000"
              onChange={(event) => setForm({ ...form, contextWindow: event.target.value })}
              onBlur={() => commit(form)}
            />
          </SettingRow>
          <SettingRow title="Max tokens">
            <Input
              className="w-36 text-xs"
              value={form.maxTokens}
              placeholder="16384"
              onChange={(event) => setForm({ ...form, maxTokens: event.target.value })}
              onBlur={() => commit(form)}
            />
          </SettingRow>
          <SettingRow title="Reasoning">
            <Switch
              checked={form.reasoning}
              onCheckedChange={(reasoning) => commit({ ...form, reasoning })}
            />
          </SettingRow>
          <SettingRow title="Image input">
            <Switch checked={form.image} onCheckedChange={(image) => commit({ ...form, image })} />
          </SettingRow>
        </SettingCard>
      </SettingSection>

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setAdvanced((open) => !open)}
        >
          <ChevronDown
            className={cn('size-3.5 transition-transform duration-200', !advanced && '-rotate-90')}
          />
          <span>Advanced settings</span>
        </Button>

        {advanced ? (
          <div className="mt-4 flex flex-col gap-6">
            <SettingSection title="Token pricing (per 1M tokens)">
              <SettingCard>
                <SettingRow title="Input">
                  <Input
                    className="w-36 text-xs"
                    value={form.costInput}
                    placeholder="0"
                    onChange={(event) => setForm({ ...form, costInput: event.target.value })}
                    onBlur={() => commit(form)}
                  />
                </SettingRow>
                <SettingRow title="Output">
                  <Input
                    className="w-36 text-xs"
                    value={form.costOutput}
                    placeholder="0"
                    onChange={(event) => setForm({ ...form, costOutput: event.target.value })}
                    onBlur={() => commit(form)}
                  />
                </SettingRow>
                <SettingRow title="Cache read">
                  <Input
                    className="w-36 text-xs"
                    value={form.costCacheRead}
                    placeholder="0"
                    onChange={(event) => setForm({ ...form, costCacheRead: event.target.value })}
                    onBlur={() => commit(form)}
                  />
                </SettingRow>
                <SettingRow title="Cache write">
                  <Input
                    className="w-36 text-xs"
                    value={form.costCacheWrite}
                    placeholder="0"
                    onChange={(event) => setForm({ ...form, costCacheWrite: event.target.value })}
                    onBlur={() => commit(form)}
                  />
                </SettingRow>
              </SettingCard>
            </SettingSection>

            <SettingSection title="Thinking level map">
              <SettingCard>
                {THINKING_LEVELS.map((level) => (
                  <ThinkingMapRow
                    key={level}
                    level={level}
                    value={form.thinkingLevelMap[level]}
                    onChange={(value) =>
                      commit({
                        ...form,
                        thinkingLevelMap: { ...form.thinkingLevelMap, [level]: value },
                      })
                    }
                  />
                ))}
              </SettingCard>
            </SettingSection>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ThinkingMapRow({
  level,
  value,
  onChange,
}: {
  level: string
  value: string | null | undefined
  onChange: (value: string | null | undefined) => void
}) {
  const mode = value === undefined ? 'default' : value === null ? 'unsupported' : 'custom'
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 transition-colors hover:bg-muted/10">
      <span className="w-28 shrink-0 text-[13px] font-medium text-foreground capitalize">
        {level}
      </span>
      <div className="flex flex-1 items-center justify-end gap-2">
        <Select
          value={mode}
          onValueChange={(next) => {
            if (next === 'default') onChange(undefined)
            else if (next === 'unsupported') onChange(null)
            else onChange(level)
          }}
        >
          <SelectTrigger className="w-36">
            <LabeledSelectValue
              labels={{ default: 'Default', unsupported: 'Unsupported', custom: 'Custom' }}
            />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="unsupported">Unsupported</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        {typeof value === 'string' ? (
          <Input
            className="w-36 text-xs"
            value={draft ?? value}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (draft !== null) onChange(draft)
              setDraft(null)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
