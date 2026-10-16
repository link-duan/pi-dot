import { useState } from 'react'
import { ChevronRight, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import {
  modelId,
  PROVIDER_APIS,
  providerModels,
  readProviderForm,
  type JsonObject,
  type ProviderForm,
} from '@shared/models-file'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SettingCard } from '@/settings/components/SettingCard'
import { SettingBadge } from '@/settings/components/SettingBadge'
import { SettingRow } from '@/settings/components/SettingRow'
import { SettingSection } from '@/settings/components/SettingSection'
import { LabeledSelectValue } from './fields'
import { useConnectionTest } from './useConnectionTest'
import { TestResultText } from './TestResultText'
import { TestButton } from './TestButton'

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

function formatTokens(count: number): string {
  if (count >= 1000000) return `${Math.round(count / 100000) / 10}M`
  if (count >= 1000) return `${Math.round(count / 1000)}k`
  return String(count)
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
