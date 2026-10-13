import { ChevronRight, FileCode, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  applyProviderForm,
  insertModel,
  insertProvider,
  modelId,
  parseModelsFile,
  patchModelForm,
  patchProviderForm,
  PROVIDER_APIS,
  providerModels,
  readProviderForm,
  removeModel,
  removeProvider,
  type ModelsFile,
  type ProviderForm,
} from '@shared/models-file'
import { SerialQueue } from '@shared/queue'
import type {
  ModelsFileResult,
  ProviderAuthMethod,
  ProviderListItem,
  SettingsCatalog,
} from '@shared/settings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { SettingBadge, SettingCard, SettingSection } from './components/SettingCard'
import { SettingsPane, type Crumb } from './components/SettingsPane'
import { LabeledSelectValue } from './fields'
import { LoginDialog } from './LoginDialog'
import { ModelsJsonEditor } from './ModelsJsonEditor'
import { BuiltinProvider, CustomProviderEditor, DeleteAction, ModelEditor } from './ProviderDetail'

interface Login {
  id: string
  name: string
  methods: ProviderAuthMethod[]
}

export function ProvidersPage({
  catalog: loadedCatalog,
  refreshCatalog,
}: {
  catalog: SettingsCatalog | null
  refreshCatalog: () => Promise<void>
}) {
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('provider')
  const modelKey = params.get('model')
  const view = params.get('view') === 'json' ? 'json' : 'form'
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ModelsFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [login, setLogin] = useState<Login | null>(null)
  const [adding, setAdding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const textRef = useRef('')
  const savedRef = useRef('')
  const loadedRef = useRef(false)
  const writes = useRef(new SerialQueue())

  function go(next: { provider?: string; model?: string; json?: boolean }): void {
    const search: Record<string, string> = { section: 'providers' }
    if (next.json) search.view = 'json'
    else if (next.provider) search.provider = next.provider
    if (next.provider && next.model) search.model = next.model
    setPendingDelete(false)
    setParams(search, { replace: true })
  }

  function applyFile(nextText: string, nextError?: string | null): void {
    textRef.current = nextText
    setText(nextText)
    const result = parseModelsFile(nextText)
    setParsed(result.ok ? result.value : null)
    setError(nextError ?? (result.ok ? null : result.error))
  }

  function applyLoaded(file: ModelsFileResult): void {
    applyFile(file.text, file.error)
    savedRef.current = file.text
    loadedRef.current = true
  }

  function reload(): void {
    void window.pi.getModelsFile().then(applyLoaded)
    void refreshCatalog()
  }

  useEffect(() => {
    let cancelled = false
    void window.pi.getModelsFile().then((file) => {
      if (!cancelled) applyLoaded(file)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const queue = writes.current
    return () => {
      void queue.enqueue(async () => {
        if (!loadedRef.current) return
        const snapshot = textRef.current
        if (snapshot === savedRef.current) return
        if (!parseModelsFile(snapshot).ok) return
        await window.pi.setModelsFile(snapshot)
      })
    }
  }, [])

  function commitText(nextText: string): void {
    const result = parseModelsFile(nextText)
    if (!result.ok) {
      textRef.current = nextText
      setText(nextText)
      setError(result.error)
      return
    }
    applyFile(nextText)
    void writes.current.enqueue(async () => {
      const snapshot = textRef.current
      const written = await window.pi.setModelsFile(snapshot)
      if (textRef.current !== snapshot) return
      applyFile(written.text, written.error)
      if (written.error) return
      savedRef.current = snapshot
      await refreshCatalog()
    })
  }

  function leaveJson(): void {
    const result = parseModelsFile(textRef.current)
    if (!result.ok) {
      setError(result.error)
      return
    }
    commitText(textRef.current)
    go({})
  }

  function deleteSelected(providerId: string, model: string | null): void {
    if (model) {
      commitText(removeModel(textRef.current, providerId, model))
      go({ provider: providerId })
    } else {
      commitText(removeProvider(textRef.current, providerId))
      go({})
    }
  }

  const catalog = withCustomProviders(loadedCatalog, parsed)
  const providers = catalog?.providers ?? []
  const selected = providers.find((item) => item.id === selectedId) ?? null
  const selectedProvider = selectedId && parsed ? parsed.providers[selectedId] : undefined
  const isCustom = !!(selectedId && selectedProvider && selected?.kind !== 'builtin')
  const modelCount = (item: ProviderListItem): number => {
    const custom = parsed?.providers[item.id]
    if (item.kind === 'custom' && custom) return providerModels(custom).length
    return (catalog?.available ?? []).filter((model) => model.provider === item.id).length
  }

  const errorBanner = error ? (
    <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {error}
    </div>
  ) : null

  const dialogs = (
    <>
      {login ? (
        <LoginDialog
          providerId={login.id}
          providerName={login.name}
          methods={login.methods}
          onClose={(ok) => {
            setLogin(null)
            if (ok) {
              reload()
              go({ provider: login.id })
            }
          }}
        />
      ) : null}
      {adding ? (
        <AddProviderDialog
          addable={catalog?.addable ?? []}
          existing={new Set(parsed ? Object.keys(parsed.providers) : [])}
          onClose={() => setAdding(false)}
          onCustom={(id, form) => {
            commitText(insertProvider(textRef.current, id, applyProviderForm({ models: [] }, form)))
            setAdding(false)
            go({ provider: id })
          }}
          onBuiltin={(item) => {
            setAdding(false)
            if (item.configured) go({ provider: item.id })
            else setLogin({ id: item.id, name: item.name, methods: item.methods })
          }}
        />
      ) : null}
    </>
  )

  const listCrumb: Crumb = { label: 'Providers', onClick: () => go({}) }

  if (view === 'json') {
    return (
      <>
        <SettingsPane
          fill
          crumbs={[{ label: 'Providers', onClick: leaveJson }, { label: 'models.json' }]}
        >
          {errorBanner}
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60">
            <ModelsJsonEditor
              value={text}
              onChange={(value) => {
                textRef.current = value
                setText(value)
                const result = parseModelsFile(value)
                if (result.ok) {
                  setParsed(result.value)
                  setError(null)
                }
              }}
              onBlur={() => commitText(textRef.current)}
            />
          </div>
        </SettingsPane>
        {dialogs}
      </>
    )
  }

  if (selectedId && (isCustom || selected)) {
    const name =
      (selectedProvider && readProviderForm(selectedProvider).name) || selected?.name || selectedId
    const model =
      isCustom && modelKey && selectedProvider
        ? (providerModels(selectedProvider).find((item) => modelId(item) === modelKey) ?? {
            id: modelKey,
          })
        : null
    const crumbs: Crumb[] = model
      ? [
          listCrumb,
          { label: name, onClick: () => go({ provider: selectedId }) },
          { label: typeof model.name === 'string' && model.name ? model.name : modelKey! },
        ]
      : [listCrumb, { label: name }]
    return (
      <>
        <SettingsPane
          crumbs={crumbs}
          action={
            isCustom ? (
              <DeleteAction
                pending={pendingDelete}
                onArm={() => setPendingDelete(true)}
                onCancel={() => setPendingDelete(false)}
                onConfirm={() => deleteSelected(selectedId, model ? modelKey : null)}
              />
            ) : null
          }
        >
          {errorBanner}
          {model && selectedProvider ? (
            <ModelEditor
              key={`${selectedId}/${modelKey}`}
              model={model}
              onChange={(form, previousId) => {
                commitText(patchModelForm(textRef.current, selectedId, previousId, form))
                if (form.id && form.id !== previousId) go({ provider: selectedId, model: form.id })
              }}
            />
          ) : isCustom && selectedProvider ? (
            <CustomProviderEditor
              key={selectedId}
              id={selectedId}
              provider={selectedProvider}
              onChange={(form) => commitText(patchProviderForm(textRef.current, selectedId, form))}
              onAddModel={(id) => commitText(insertModel(textRef.current, selectedId, { id }))}
              onSelectModel={(id) => go({ provider: selectedId, model: id })}
            />
          ) : selected ? (
            <BuiltinProvider
              item={selected}
              models={(catalog?.usable ?? []).filter((item) => item.provider === selected.id)}
              onLogin={setLogin}
              onLogout={() => void window.pi.logout(selected.id).then(reload)}
            />
          ) : null}
        </SettingsPane>
        {dialogs}
      </>
    )
  }

  const custom = providers.filter((item) => item.kind === 'custom')
  const builtin = providers.filter((item) => item.kind === 'builtin')

  return (
    <>
      <SettingsPane
        crumbs={[{ label: 'Providers' }]}
        action={
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            Add provider
          </Button>
        }
      >
        {errorBanner}
        {catalog && providers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 px-6 py-12 text-center">
            <p className="text-[13px] font-medium text-foreground">No providers yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Sign in to a built-in provider such as Anthropic or OpenAI, or add your own
              OpenAI-compatible endpoint.
            </p>
            <Button type="button" size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" />
              Add provider
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-8 pb-12">
            {builtin.length > 0 ? (
              <ProviderList
                title="Built-in"
                items={builtin}
                count={modelCount}
                onSelect={(id) => go({ provider: id })}
              />
            ) : null}
            {custom.length > 0 ? (
              <ProviderList
                title="Custom"
                items={custom}
                count={modelCount}
                onSelect={(id) => go({ provider: id })}
              />
            ) : null}
            <SettingSection title="Advanced">
              <SettingCard>
                <ListButton onClick={() => go({ json: true })}>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <FileCode className="size-3.5" />
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-foreground">
                    Edit models.json
                  </span>
                </ListButton>
              </SettingCard>
            </SettingSection>
          </div>
        )}
      </SettingsPane>
      {dialogs}
    </>
  )
}

function ProviderList({
  title,
  items,
  count,
  onSelect,
}: {
  title: string
  items: ProviderListItem[]
  count: (item: ProviderListItem) => number
  onSelect: (id: string) => void
}) {
  return (
    <SettingSection title={title}>
      <SettingCard>
        {items.map((item) => {
          const name = item.name.trim() || item.id
          const models = count(item)
          return (
            <ListButton key={item.id} onClick={() => onSelect(item.id)}>
              <ProviderAvatar name={name} />
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate text-[13px] font-medium text-foreground">{name}</span>
                {name !== item.id ? (
                  <span className="truncate text-[11px] text-muted-foreground">{item.id}</span>
                ) : null}
              </span>
              <span
                className={cn(
                  'shrink-0 text-xs tabular-nums',
                  item.configured ? 'text-muted-foreground' : 'text-warning',
                )}
              >
                {item.configured
                  ? models === 1
                    ? '1 model'
                    : `${models} models`
                  : 'Not connected'}
              </span>
            </ListButton>
          )
        })}
      </SettingCard>
    </SettingSection>
  )
}

function ListButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/30 focus-visible:bg-muted/40"
      onClick={onClick}
    >
      {children}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
    </button>
  )
}

function ProviderAvatar({ name }: { name: string }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground uppercase">
      {name.replace(/^[^a-z0-9]+/i, '').charAt(0) || '?'}
    </span>
  )
}

/** The catalog with custom providers taken from `file`, which may be ahead of what pi has loaded. */
function withCustomProviders(
  catalog: SettingsCatalog | null,
  file: ModelsFile | null,
): SettingsCatalog | null {
  if (!catalog || !file) return catalog
  const customIds = Object.keys(file.providers)
  const customSet = new Set(customIds)
  const known = new Map(
    [...catalog.providers, ...catalog.addable].map((item) => [item.id, item] as const),
  )
  const custom: ProviderListItem[] = customIds.map((id) => {
    const item = known.get(id)
    const named = file.providers[id]?.name
    const name = typeof named === 'string' && named.trim() ? named : (item?.name ?? id)
    return {
      id,
      name,
      kind: 'custom',
      configured: item?.configured ?? false,
      authSource: item?.authSource ?? 'none',
      authLabel: item?.authLabel,
      methods: item?.methods ?? [],
    }
  })
  const builtin = catalog.providers.filter(
    (item) => item.kind === 'builtin' && !customSet.has(item.id),
  )
  return { ...catalog, providers: [...custom, ...builtin] }
}

const EMPTY_FORM: ProviderForm = {
  name: '',
  baseUrl: '',
  api: 'openai-completions',
  apiKey: '',
  authHeader: false,
  headers: [],
}

function AddProviderDialog({
  addable,
  existing,
  onClose,
  onCustom,
  onBuiltin,
}: {
  addable: ProviderListItem[]
  existing: Set<string>
  onClose: () => void
  onCustom: (id: string, form: ProviderForm) => void
  onBuiltin: (item: ProviderListItem) => void
}) {
  const [step, setStep] = useState<'pick' | 'custom'>('pick')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return addable.filter(
      (item) => !needle || `${item.name} ${item.id}`.toLowerCase().includes(needle),
    )
  }, [addable, query])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 border-border/60 bg-background/95 p-0 backdrop-blur-xl sm:max-w-lg">
        {step === 'pick' ? (
          <div className="flex flex-col">
            <DialogHeader className="px-5 pt-5 pb-3">
              <DialogTitle>Add provider</DialogTitle>
              <DialogDescription>
                Sign in to a built-in provider, or connect your own endpoint.
              </DialogDescription>
            </DialogHeader>
            <div className="px-5 pb-3">
              <InputGroup>
                <InputGroupAddon>
                  <Search className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  autoFocus
                  aria-label="Search providers"
                  placeholder="Search providers…"
                  className="text-xs"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </InputGroup>
            </div>
            <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto border-t border-border/40 p-2">
              <PickItem onClick={() => setStep('custom')}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Plus className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13px] font-medium text-foreground">Custom provider</span>
                  <span className="text-xs text-muted-foreground">
                    OpenAI-compatible endpoint, Ollama, vLLM, LM Studio…
                  </span>
                </span>
              </PickItem>
              <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-muted-foreground/70">
                Built-in
              </div>
              {filtered.map((item) => {
                const unavailable = !item.configured && item.methods.length === 0
                return (
                  <PickItem key={item.id} disabled={unavailable} onClick={() => onBuiltin(item)}>
                    <ProviderAvatar name={item.name || item.id} />
                    <span className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {item.name}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">{item.id}</span>
                    </span>
                    {item.configured ? (
                      <SettingBadge>Signed in</SettingBadge>
                    ) : unavailable ? (
                      <span className="text-[11px] text-muted-foreground">Uses env API key</span>
                    ) : null}
                  </PickItem>
                )
              })}
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No built-in provider matches “{query}”
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <CustomProviderForm
            existing={existing}
            onBack={() => setStep('pick')}
            onCancel={onClose}
            onCreate={onCustom}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PickItem({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/60',
        'disabled:pointer-events-none disabled:opacity-50',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function CustomProviderForm({
  existing,
  onBack,
  onCancel,
  onCreate,
}: {
  existing: Set<string>
  onBack: () => void
  onCancel: () => void
  onCreate: (id: string, form: ProviderForm) => void
}) {
  const [id, setId] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const trimmed = id.trim()
  const idError = existing.has(trimmed)
    ? 'A provider with this ID already exists'
    : /\s|\//.test(trimmed)
      ? 'Use letters, numbers and dashes'
      : null
  const valid = !!trimmed && !idError && !!form.baseUrl.trim()

  return (
    <form
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) onCreate(trimmed, { ...form, baseUrl: form.baseUrl.trim() })
      }}
    >
      <DialogHeader className="px-5 pt-5 pb-4">
        <DialogTitle>Custom provider</DialogTitle>
        <DialogDescription>You can add models and headers after it’s created.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3.5 px-5 pb-5">
        <Field label="Provider ID" hint={idError} error={!!idError}>
          <Input
            autoFocus
            value={id}
            placeholder="ollama"
            className="text-xs"
            aria-invalid={!!idError}
            onChange={(event) => setId(event.target.value)}
          />
        </Field>
        <Field label="Display name">
          <Input
            value={form.name}
            placeholder={trimmed || 'Ollama'}
            className="text-xs"
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Base URL">
          <Input
            value={form.baseUrl}
            placeholder="http://localhost:11434/v1"
            className="text-xs"
            onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="API protocol">
            <Select value={form.api} onValueChange={(api) => api && setForm({ ...form, api })}>
              <SelectTrigger className="w-full">
                <LabeledSelectValue
                  labels={Object.fromEntries(PROVIDER_APIS.map((api) => [api, api]))}
                />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_APIS.map((api) => (
                  <SelectItem key={api} value={api}>
                    {api}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="API key" hint="Optional">
            <Input
              type="password"
              value={form.apiKey}
              placeholder="sk-…"
              className="text-xs"
              onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
            />
          </Field>
        </div>
      </div>
      <div className="flex justify-between border-t border-border/40 px-5 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!valid}>
            Create provider
          </Button>
        </div>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  error = false,
  children,
}: {
  label: string
  hint?: string | null
  error?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-xs font-medium text-foreground">
        {label}
        {hint ? (
          <span
            className={cn(
              'text-[11px] font-normal',
              error ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {hint}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  )
}
