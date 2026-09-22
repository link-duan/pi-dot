import { Code2, FileCode, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  insertModel,
  insertProvider,
  modelId,
  parseModelsFile,
  patchModelForm,
  patchProviderForm,
  providerJsonOffset,
  providerModels,
  readProviderForm,
  removeModel,
  removeProvider,
  type ModelsFile,
} from '@shared/models-file'
import { SerialQueue } from '@shared/queue'
import type { ProviderAuthMethod, ProviderListItem, SettingsCatalog } from '@shared/settings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@/components/ui/scroll-area'
import { LoginDialog } from './LoginDialog'
import { ModelsJsonEditor } from './ModelsJsonEditor'
import { BuiltinProvider, CustomProviderEditor, ModelEditor } from './ProviderDetail'

type View = 'form' | 'json'

export function ProvidersPage() {
  const [view, setView] = useState<View>('form')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ModelsFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<SettingsCatalog | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modelKey, setModelKey] = useState<string | null>(null)
  const [jsonOffset, setJsonOffset] = useState<number | undefined>()
  const [login, setLogin] = useState<{
    id: string
    name: string
    methods: ProviderAuthMethod[]
  } | null>(null)
  const [adding, setAdding] = useState<'pick' | 'builtin' | 'custom' | null>(null)
  const textRef = useRef('')
  const savedRef = useRef('')
  const loadedRef = useRef(false)
  const writes = useRef(new SerialQueue())

  function applyFile(
    nextText: string,
    nextCatalog?: SettingsCatalog,
    nextError?: string | null,
  ): void {
    textRef.current = nextText
    setText(nextText)
    const result = parseModelsFile(nextText)
    setParsed(result.ok ? result.value : null)
    setError(nextError ?? (result.ok ? null : result.error))
    if (nextCatalog) setCatalog(syncCatalog(nextCatalog, result.ok ? result.value : null))
    else if (result.ok) setCatalog((current) => syncCatalog(current, result.value))
  }

  async function load(): Promise<void> {
    const [file, nextCatalog] = await Promise.all([
      window.pi.getModelsFile(),
      window.pi.getCatalog(),
    ])
    applyFile(file.text, nextCatalog, file.error)
    savedRef.current = file.text
    loadedRef.current = true
    setSelectedId((current) => current ?? nextCatalog.providers[0]?.id ?? null)
  }

  useEffect(() => {
    let cancelled = false
    void Promise.all([window.pi.getModelsFile(), window.pi.getCatalog()]).then(
      ([file, nextCatalog]) => {
        if (cancelled) return
        applyFile(file.text, nextCatalog, file.error)
        savedRef.current = file.text
        loadedRef.current = true
        setSelectedId((current) => current ?? nextCatalog.providers[0]?.id ?? null)
      },
    )
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
      applyFile(written.text, undefined, written.error)
      if (!written.error) savedRef.current = snapshot
    })
  }

  function openForm(id: string): void {
    if (view === 'json') {
      const result = parseModelsFile(textRef.current)
      if (!result.ok) {
        setError(result.error)
        return
      }
      commitText(textRef.current)
    }
    setSelectedId(id)
    setModelKey(null)
    setView('form')
  }

  function openAdvanced(): void {
    setJsonOffset(selectedId ? providerJsonOffset(text, selectedId) : undefined)
    setView('json')
  }

  const providers = catalog?.providers ?? []
  const selected = providers.find((item) => item.id === selectedId) ?? null
  const selectedProvider = selectedId && parsed ? parsed.providers[selectedId] : undefined
  const isCustom = !!(selectedId && selectedProvider && selected?.kind !== 'builtin')

  return (
    <div className="app-no-drag flex h-full min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border/40 bg-muted/10">
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-3 pb-1.5">
          <span className="text-xs font-medium text-muted-foreground">Providers</span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Add provider"
            onClick={() => setAdding('pick')}
          >
            <Plus />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <ScrollAreaViewport className="px-2 pt-1 pb-2">
            <ProviderGroup
              items={providers}
              selectedId={view === 'form' ? selectedId : null}
              onSelect={openForm}
            />
          </ScrollAreaViewport>
          <ScrollAreaScrollbar />
        </ScrollArea>
        <div className="shrink-0 border-t border-border/40 p-2">
          <Button
            type="button"
            variant={view === 'json' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-2 text-[13px] font-normal focus-visible:border-transparent focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-0"
            onClick={openAdvanced}
          >
            <Code2 className="size-4 shrink-0 text-muted-foreground" />
            Advanced
          </Button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {error ? (
          <div className="mx-4 mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {view === 'json' ? (
          <div className="min-h-0 flex-1 pt-3">
            <ModelsJsonEditor
              value={text}
              offset={jsonOffset}
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
        ) : (
          <ScrollArea className="flex-1">
            <ScrollAreaViewport className="px-6 pt-3 pb-8">
              {isCustom && selectedProvider && selectedId ? (
                modelKey ? (
                  <ModelEditor
                    key={modelKey}
                    providerName={readProviderForm(selectedProvider).name || selectedId}
                    model={
                      providerModels(selectedProvider).find(
                        (item) => modelId(item) === modelKey,
                      ) ?? {
                        id: modelKey,
                      }
                    }
                    onBack={() => setModelKey(null)}
                    onChange={(form, previousId) => {
                      commitText(patchModelForm(textRef.current, selectedId, previousId, form))
                      setModelKey(form.id || previousId)
                    }}
                    onDelete={() => {
                      commitText(removeModel(textRef.current, selectedId, modelKey))
                      setModelKey(null)
                    }}
                  />
                ) : (
                  <CustomProviderEditor
                    key={selectedId}
                    id={selectedId}
                    provider={selectedProvider}
                    onChange={(form) =>
                      commitText(patchProviderForm(textRef.current, selectedId, form))
                    }
                    onAddModel={(id) => {
                      commitText(insertModel(textRef.current, selectedId, { id }))
                      setModelKey(id)
                    }}
                    onDelete={() => {
                      commitText(removeProvider(textRef.current, selectedId))
                      setSelectedId(null)
                    }}
                    onSelectModel={setModelKey}
                  />
                )
              ) : selected?.kind === 'builtin' ? (
                <BuiltinProvider
                  item={selected}
                  onLogin={setLogin}
                  onLogout={() => void window.pi.logout(selected.id).then(() => load())}
                />
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                  <FileCode className="size-8 opacity-40" />
                  <span>Select a provider or add a new one to begin.</span>
                </div>
              )}
            </ScrollAreaViewport>
            <ScrollAreaScrollbar />
          </ScrollArea>
        )}
      </div>

      {login ? (
        <LoginDialog
          providerId={login.id}
          providerName={login.name}
          methods={login.methods}
          onClose={(ok) => {
            setLogin(null)
            if (ok) void load()
          }}
        />
      ) : null}

      {adding ? (
        <AddProviderDialog
          mode={adding}
          addable={catalog?.addable ?? []}
          existing={new Set(parsed ? Object.keys(parsed.providers) : [])}
          onMode={setAdding}
          onClose={() => setAdding(null)}
          onCustom={(id) => {
            commitText(insertProvider(textRef.current, id))
            openForm(id)
            setAdding(null)
          }}
          onBuiltin={(item) => {
            setAdding(null)
            if (item.methods.length > 0)
              setLogin({ id: item.id, name: item.name, methods: item.methods })
          }}
        />
      ) : null}
    </div>
  )
}

function syncCatalog(
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
      authLabel: item?.authLabel,
      methods: item?.methods ?? [],
    }
  })
  const builtin = catalog.providers.filter(
    (item) => item.kind === 'builtin' && !customSet.has(item.id),
  )
  return { ...catalog, providers: [...custom, ...builtin] }
}

function providerLabel(item: ProviderListItem): string {
  return item.name.trim() || item.id
}

function ProviderGroup({
  items,
  selectedId,
  onSelect,
}: {
  items: ProviderListItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (items.length === 0) {
    return <p className="px-2 py-2 text-xs text-muted-foreground/70 italic">None</p>
  }
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => {
        const isSelected = item.id === selectedId
        return (
          <Button
            key={item.id}
            type="button"
            variant={isSelected ? 'secondary' : 'ghost'}
            className="h-8 w-full justify-between gap-2 px-2.5 text-left focus-visible:border-transparent focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-0"
            onClick={() => onSelect(item.id)}
          >
            <span className="min-w-0 truncate text-xs font-medium text-foreground">
              {providerLabel(item)}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {item.kind === 'custom' ? 'Custom' : 'Built-in'}
            </span>
          </Button>
        )
      })}
    </div>
  )
}

function AddProviderDialog({
  mode,
  addable,
  existing,
  onMode,
  onClose,
  onCustom,
  onBuiltin,
}: {
  mode: 'pick' | 'builtin' | 'custom'
  addable: ProviderListItem[]
  existing: Set<string>
  onMode: (mode: 'pick' | 'builtin' | 'custom') => void
  onClose: () => void
  onCustom: (id: string) => void
  onBuiltin: (item: ProviderListItem) => void
}) {
  const [query, setQuery] = useState('')
  const [customId, setCustomId] = useState('')
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return addable.filter(
      (item) => !needle || `${item.name} ${item.id}`.toLowerCase().includes(needle),
    )
  }, [addable, query])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border/60 bg-background/95 backdrop-blur-xl sm:max-w-md">
        {mode === 'pick' ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Add provider</DialogTitle>
              <DialogDescription>
                Choose how you want to connect your LLM provider
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-auto flex-col items-start p-3 text-left"
                onClick={() => onMode('builtin')}
              >
                <span className="text-sm font-medium text-foreground">Built-in provider</span>
                <span className="text-xs text-muted-foreground">
                  Connect Anthropic, GitHub Copilot, OpenAI, and more with OAuth
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto flex-col items-start p-3 text-left"
                onClick={() => onMode('custom')}
              >
                <span className="text-sm font-medium text-foreground">Custom provider</span>
                <span className="text-xs text-muted-foreground">
                  Configure custom OpenAI-compatible endpoints, Ollama, or vLLM
                </span>
              </Button>
            </div>
            <div className="flex justify-end border-t border-border/40 pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {mode === 'builtin' ? (
          <div className="flex flex-col gap-3">
            <DialogHeader>
              <DialogTitle>Built-in providers</DialogTitle>
              <DialogDescription>Select a supported provider to configure</DialogDescription>
            </DialogHeader>
            <Input
              value={query}
              placeholder="Search providers…"
              className="text-xs"
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto py-1">
              {filtered.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-between px-3 py-2 text-left"
                  onClick={() => onBuiltin(item)}
                >
                  <span className="text-xs font-medium text-foreground">{item.name}</span>
                  <span className="text-[10px] text-muted-foreground">{item.id}</span>
                </Button>
              ))}
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No matching providers found
                </p>
              ) : null}
            </div>
            <div className="flex justify-between border-t border-border/40 pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => onMode('pick')}>
                Back
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {mode === 'custom' ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              const id = customId.trim()
              if (!id || existing.has(id)) return
              onCustom(id)
            }}
          >
            <DialogHeader>
              <DialogTitle>Custom provider</DialogTitle>
              <DialogDescription>
                Enter a unique identifier for this provider (e.g. ollama, deepseek)
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Input
                value={customId}
                placeholder="provider-id"
                className="text-xs"
                onChange={(event) => setCustomId(event.target.value)}
                autoFocus
              />
              {existing.has(customId.trim()) ? (
                <p className="text-[11px] text-destructive">That provider ID already exists.</p>
              ) : null}
            </div>
            <div className="flex justify-between border-t border-border/40 pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => onMode('pick')}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!customId.trim() || existing.has(customId.trim())}
                >
                  Create
                </Button>
              </div>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
