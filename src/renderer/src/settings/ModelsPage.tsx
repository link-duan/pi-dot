import { ChevronRight, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  modelKey,
  THINKING_LEVEL_LABELS,
  THINKING_LEVELS,
  type ModelInfo,
  type ThinkingLevel,
} from '@shared/protocol'
import {
  enabledModelPatterns,
  resolveEnabledModels,
  type ModelSettings,
  type ModelSettingsPatch,
  type ProviderListItem,
} from '@shared/settings'
import { ModelPickerDropdown } from '@/components/pickers/ModelPickerDropdown'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { SettingCard } from './components/SettingCard'
import { SettingRow } from '@/settings/components/SettingRow'
import { SettingSection } from '@/settings/components/SettingSection'
import { LabeledSelectValue } from './fields'

const DEFAULT_LEVEL = 'default'

export function ModelsPage({
  settings,
  usable,
  providers,
  onPatch,
}: {
  settings: ModelSettings
  usable: ModelInfo[]
  providers: ProviderListItem[]
  onPatch: (patch: ModelSettingsPatch) => void
}) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const defaultKey =
    settings.defaultProvider && settings.defaultModel
      ? `${settings.defaultProvider}/${settings.defaultModel}`
      : ''

  const defaultOptions = useMemo(() => {
    if (!defaultKey || usable.some((item) => modelKey(item) === defaultKey)) return usable
    return [
      ...usable,
      {
        provider: settings.defaultProvider,
        id: settings.defaultModel,
        name: settings.defaultModel,
        thinkingLevels: [...THINKING_LEVELS],
      },
    ]
  }, [usable, defaultKey, settings.defaultProvider, settings.defaultModel])

  const defaultModel = defaultOptions.find((item) => modelKey(item) === defaultKey)
  const defaultLevels = defaultModel?.thinkingLevels ?? THINKING_LEVELS

  const enabled = useMemo(
    () =>
      settings.enabledModels
        ? resolveEnabledModels(settings.enabledModels, usable)
        : new Set(usable.map(modelKey)),
    [settings.enabledModels, usable],
  )
  const providerNames = new Map(providers.map((item) => [item.id, item.name.trim() || item.id]))
  const needle = query.trim().toLowerCase()
  const groups = new Map<string, ModelInfo[]>()
  for (const model of usable) {
    const haystack = `${model.provider} ${providerNames.get(model.provider) ?? ''} ${model.id} ${model.name}`
    if (needle && !haystack.toLowerCase().includes(needle)) continue
    groups.set(model.provider, [...(groups.get(model.provider) ?? []), model])
  }
  const usableKeys = new Set(usable.map(modelKey))
  const staleOverrides = Object.entries(settings.modelThinkingLevels).filter(
    ([key]) => !usableKeys.has(key),
  )

  function setVisible(keys: string[], visible: boolean): void {
    const next = new Set(enabled)
    for (const key of keys) {
      if (visible) next.add(key)
      else next.delete(key)
    }
    if (next.size === 0) return
    onPatch({ enabledModels: enabledModelPatterns(settings.enabledModels, usable, next) })
  }

  function setLevel(key: string, level: string): void {
    const next = { ...settings.modelThinkingLevels }
    if (level === DEFAULT_LEVEL) delete next[key]
    else next[key] = level as ThinkingLevel
    onPatch({ modelThinkingLevels: next })
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <SettingSection title="Defaults">
        <SettingCard>
          <SettingRow title="Default model" description="Used for new sessions">
            <ModelPickerDropdown
              models={defaultOptions}
              value={defaultKey}
              onChange={(_key, next) => {
                const levels = next.thinkingLevels ?? THINKING_LEVELS
                const level =
                  settings.defaultThinkingLevel && levels.includes(settings.defaultThinkingLevel)
                    ? settings.defaultThinkingLevel
                    : levels.includes('high')
                      ? 'high'
                      : (levels[0] ?? 'off')
                onPatch({
                  defaultProvider: next.provider,
                  defaultModel: next.id,
                  defaultThinkingLevel: level,
                })
              }}
            />
          </SettingRow>
          <SettingRow
            title="Default reasoning effort"
            description="Unless a model below sets its own"
          >
            <LevelSelect
              levels={defaultLevels}
              value={
                settings.defaultThinkingLevel &&
                defaultLevels.includes(settings.defaultThinkingLevel)
                  ? settings.defaultThinkingLevel
                  : (defaultLevels[0] ?? 'off')
              }
              onChange={(value) => onPatch({ defaultThinkingLevel: value as ThinkingLevel })}
            />
          </SettingRow>
        </SettingCard>
      </SettingSection>

      <SettingSection
        title="All models"
        description={
          enabled.size < usable.length ? `${usable.length - enabled.size} hidden` : undefined
        }
        action={
          <InputGroup className="h-7 w-56">
            <InputGroupAddon>
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search models"
              placeholder="Search models…"
              className="text-xs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
        }
      >
        {usable.length === 0 ? (
          <SettingCard>
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              No models yet. Connect a provider to use its models.
            </div>
          </SettingCard>
        ) : groups.size === 0 ? (
          <SettingCard>
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              No models match “{query}”.
            </div>
          </SettingCard>
        ) : (
          <div className="flex flex-col gap-3">
            {[...groups].map(([provider, models]) => {
              const keys = models.map(modelKey)
              const shown = keys.filter((key) => enabled.has(key)).length
              const open = !!needle || expanded.has(provider)
              return (
                <SettingCard key={provider}>
                  <div className="flex items-center justify-between gap-4 pr-4 hover:bg-muted/15">
                    <button
                      type="button"
                      aria-expanded={open}
                      className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3 text-left outline-none focus-visible:bg-muted/30"
                      onClick={() =>
                        setExpanded((current) => {
                          const next = new Set(current)
                          if (next.has(provider)) next.delete(provider)
                          else next.add(provider)
                          return next
                        })
                      }
                    >
                      <ChevronRight
                        className={cn(
                          'size-3.5 shrink-0 text-muted-foreground transition-transform',
                          open && 'rotate-90',
                        )}
                      />
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {providerNames.get(provider) ?? provider}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {shown === models.length
                          ? `${models.length} models`
                          : `${shown} of ${models.length} shown`}
                      </span>
                    </button>
                    <Switch
                      size="sm"
                      aria-label={`Show all ${providerNames.get(provider) ?? provider} models`}
                      checked={shown === models.length}
                      disabled={shown === models.length && shown === enabled.size}
                      onCheckedChange={(visible) => setVisible(keys, visible)}
                    />
                  </div>
                  {open
                    ? models.map((model) => {
                        const key = modelKey(model)
                        const visible = enabled.has(key)
                        const levels = model.thinkingLevels ?? []
                        return (
                          <div
                            key={key}
                            className="flex h-10 items-center justify-between gap-4 pr-4 pl-9 transition-colors hover:bg-muted/15"
                          >
                            <div
                              className={cn(
                                'flex min-w-0 items-baseline gap-2',
                                !visible && 'opacity-50',
                              )}
                            >
                              <span className="truncate text-[13px] text-foreground">
                                {model.name}
                              </span>
                              {model.name !== model.id ? (
                                <span className="truncate text-[11px] text-muted-foreground">
                                  {model.id}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              {levels.length > 1 ? (
                                <LevelSelect
                                  levels={levels}
                                  value={settings.modelThinkingLevels[key] ?? DEFAULT_LEVEL}
                                  onChange={(value) => setLevel(key, value)}
                                  withDefault
                                />
                              ) : null}
                              <Switch
                                size="sm"
                                aria-label={`Show ${model.name} in the model picker`}
                                checked={visible}
                                disabled={visible && enabled.size === 1}
                                onCheckedChange={(next) => setVisible([key], next)}
                              />
                            </div>
                          </div>
                        )
                      })
                    : null}
                </SettingCard>
              )
            })}
          </div>
        )}
      </SettingSection>

      {staleOverrides.length > 0 ? (
        <SettingSection
          title="Other reasoning overrides"
          description="For models that are not available right now"
        >
          <SettingCard>
            {staleOverrides.map(([key, level]) => (
              <SettingRow key={key} title={key}>
                <span className="text-xs text-muted-foreground">
                  {THINKING_LEVEL_LABELS[level]}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove override for ${key}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setLevel(key, DEFAULT_LEVEL)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </SettingRow>
            ))}
          </SettingCard>
        </SettingSection>
      ) : null}
    </div>
  )
}

function LevelSelect({
  levels,
  value,
  onChange,
  withDefault = false,
}: {
  levels: readonly ThinkingLevel[]
  value: string
  onChange: (value: string) => void
  withDefault?: boolean
}) {
  const labels: Record<string, string> = { [DEFAULT_LEVEL]: 'Default', ...THINKING_LEVEL_LABELS }
  return (
    <Select value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger
        variant="ghost"
        size="sm"
        aria-label="Reasoning effort"
        className={cn(
          'gap-1.5 px-2 text-xs font-normal',
          value === DEFAULT_LEVEL && 'text-muted-foreground',
        )}
      >
        <LabeledSelectValue labels={labels} />
      </SelectTrigger>
      <SelectContent align="end" className="w-auto min-w-28">
        {withDefault ? (
          <SelectItem value={DEFAULT_LEVEL} className="text-xs">
            Default
          </SelectItem>
        ) : null}
        {levels.map((level) => (
          <SelectItem key={level} value={level} className="text-xs">
            {THINKING_LEVEL_LABELS[level]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
