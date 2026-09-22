import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  THINKING_LEVEL_LABELS,
  THINKING_LEVELS,
  type ModelInfo,
  type ThinkingLevel,
} from '@shared/protocol'
import type { AppSettings } from '@shared/settings'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { SettingCard, SettingRow, SettingSection } from './components/SettingCard'
import { LabeledSelectValue } from './fields'

function modelKey(model: ModelInfo): string {
  return `${model.provider}/${model.id}`
}

export function ModelsPage({
  settings,
  available,
  onPatch,
}: {
  settings: AppSettings
  available: ModelInfo[]
  onPatch: (patch: Partial<AppSettings>) => void
}) {
  const defaultKey =
    settings.defaultProvider && settings.defaultModel
      ? `${settings.defaultProvider}/${settings.defaultModel}`
      : ''

  const options = useMemo(() => {
    const keys = new Set(available.map(modelKey))
    const extras = Object.keys(settings.modelThinkingLevels)
      .filter((key) => !keys.has(key))
      .map((key) => {
        const [provider, ...rest] = key.split('/')
        return { provider: provider ?? '', id: rest.join('/'), name: rest.join('/') }
      })
    return [...available, ...extras]
  }, [available, settings.modelThinkingLevels])

  const overridesList = Object.entries(settings.modelThinkingLevels)

  const defaultModelInfo = available.find(
    (item) => item.provider === settings.defaultProvider && item.id === settings.defaultModel,
  )
  const defaultModelLevels = defaultModelInfo?.thinkingLevels ?? THINKING_LEVELS

  return (
    <div className="flex flex-col gap-8 pb-12">
      <SettingSection title="Default model & reasoning">
        <SettingCard>
          <SettingRow title="Default model">
            <div className="w-64">
              <ModelCombobox
                models={available}
                value={defaultKey}
                onChange={(key) => {
                  const [provider, ...rest] = key.split('/')
                  const id = rest.join('/')
                  if (provider && id) {
                    const nextModel = available.find((m) => m.provider === provider && m.id === id)
                    const nextLevels = nextModel?.thinkingLevels ?? THINKING_LEVELS
                    const nextLevel =
                      settings.defaultThinkingLevel &&
                      nextLevels.includes(settings.defaultThinkingLevel)
                        ? settings.defaultThinkingLevel
                        : nextLevels.includes('high')
                          ? 'high'
                          : (nextLevels[0] ?? 'off')
                    onPatch({
                      defaultProvider: provider,
                      defaultModel: id,
                      defaultThinkingLevel: nextLevel,
                    })
                  }
                }}
              />
            </div>
          </SettingRow>

          <SettingRow title="Default reasoning effort">
            <Select
              value={
                settings.defaultThinkingLevel &&
                defaultModelLevels.includes(settings.defaultThinkingLevel)
                  ? settings.defaultThinkingLevel
                  : (defaultModelLevels[0] ?? 'off')
              }
              onValueChange={(value) => {
                if (value) onPatch({ defaultThinkingLevel: value as ThinkingLevel })
              }}
            >
              <SelectTrigger className="w-36">
                <LabeledSelectValue labels={THINKING_LEVEL_LABELS} />
              </SelectTrigger>
              <SelectContent align="end">
                {defaultModelLevels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {THINKING_LEVEL_LABELS[level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        </SettingCard>
      </SettingSection>

      <SettingSection title="Per-model reasoning overrides">
        <SettingCard>
          {overridesList.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              No model-specific thinking overrides configured. All models use the default reasoning
              effort.
            </div>
          ) : (
            overridesList.map(([key, level]) => {
              const [provider, ...rest] = key.split('/')
              const id = rest.join('/')
              const modelInfo = available.find((m) => m.provider === provider && m.id === id)
              const supportedLevels = modelInfo?.thinkingLevels ?? THINKING_LEVELS

              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/15"
                >
                  <div className="flex min-w-0 items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">{provider}</span>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="truncate font-medium text-foreground">{id}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Select
                      value={
                        supportedLevels.includes(level) ? level : (supportedLevels[0] ?? level)
                      }
                      onValueChange={(value) => {
                        if (!value) return
                        onPatch({
                          modelThinkingLevels: {
                            ...settings.modelThinkingLevels,
                            [key]: value as ThinkingLevel,
                          },
                        })
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <LabeledSelectValue labels={THINKING_LEVEL_LABELS} />
                      </SelectTrigger>
                      <SelectContent align="end">
                        {supportedLevels.map((item) => (
                          <SelectItem key={item} value={item}>
                            {THINKING_LEVEL_LABELS[item]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove override for ${key}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const next = { ...settings.modelThinkingLevels }
                        delete next[key]
                        onPatch({ modelThinkingLevels: next })
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
          <div className="border-t border-border/40 bg-muted/20 px-4 py-3">
            <AddThinkingOverride
              models={options}
              existing={settings.modelThinkingLevels}
              onAdd={(key, level) =>
                onPatch({ modelThinkingLevels: { ...settings.modelThinkingLevels, [key]: level } })
              }
            />
          </div>
        </SettingCard>
      </SettingSection>
    </div>
  )
}

function ModelCombobox({
  models,
  value,
  onChange,
  placeholder = 'Select model…',
  className,
}: {
  models: ModelInfo[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const selected = models.find((item) => modelKey(item) === value)
  return (
    <Combobox
      items={models}
      value={selected ?? null}
      onValueChange={(item) => item && onChange(modelKey(item))}
      itemToStringLabel={(item) => item.name}
      isItemEqualToValue={(left, right) => modelKey(left) === modelKey(right)}
    >
      <ComboboxInput className={cn('w-full text-xs', className)} placeholder={placeholder} />
      <ComboboxContent align="start">
        <ComboboxEmpty className="py-4 text-xs">No models available</ComboboxEmpty>
        <ComboboxList>
          {(item: ModelInfo) => (
            <ComboboxItem
              key={modelKey(item)}
              value={item}
              className="flex items-center justify-between px-2.5 py-1.5 text-xs"
            >
              <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                <span className="truncate font-medium text-foreground">{item.name}</span>
                {item.provider ? (
                  <span className="truncate text-[11px] text-muted-foreground">
                    {item.provider}
                  </span>
                ) : null}
              </div>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function AddThinkingOverride({
  models,
  existing,
  onAdd,
}: {
  models: ModelInfo[]
  existing: Record<string, ThinkingLevel>
  onAdd: (key: string, level: ThinkingLevel) => void
}) {
  const [key, setKey] = useState('')
  const unused = models.filter((item) => !(modelKey(item) in existing))
  const selectedModel = unused.find((item) => modelKey(item) === key)
  const availableLevels = selectedModel?.thinkingLevels ?? THINKING_LEVELS
  const [level, setLevel] = useState<ThinkingLevel>('high')
  const resolvedLevel = availableLevels.includes(level)
    ? level
    : availableLevels.includes('high')
      ? 'high'
      : (availableLevels[0] ?? 'off')

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="w-64">
        <ModelCombobox
          models={unused}
          value={key}
          onChange={setKey}
          placeholder={unused.length === 0 ? 'All models configured' : 'Select model…'}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={resolvedLevel}
          disabled={!key}
          onValueChange={(value) => value && setLevel(value as ThinkingLevel)}
        >
          <SelectTrigger className="w-28">
            <LabeledSelectValue labels={THINKING_LEVEL_LABELS} />
          </SelectTrigger>
          <SelectContent align="end">
            {availableLevels.map((item) => (
              <SelectItem key={item} value={item}>
                {THINKING_LEVEL_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!key || unused.length === 0}
          onClick={() => {
            if (!key) return
            onAdd(key, resolvedLevel)
            setKey('')
          }}
        >
          <Plus className="size-3.5" />
          Add override
        </Button>
      </div>
    </div>
  )
}
