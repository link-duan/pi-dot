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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { SettingCard, SettingRow, SettingSection } from './components/SettingCard'
import { LabeledSelectValue } from './fields'
import { ModelPickerDropdown, modelKey } from '@/components/ModelPicker'

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
    const extras: ModelInfo[] = []
    if (
      settings.defaultProvider &&
      settings.defaultModel &&
      !keys.has(`${settings.defaultProvider}/${settings.defaultModel}`)
    ) {
      extras.push({
        provider: settings.defaultProvider,
        id: settings.defaultModel,
        name: settings.defaultModel,
        thinkingLevels: [...THINKING_LEVELS],
      })
      keys.add(`${settings.defaultProvider}/${settings.defaultModel}`)
    }
    for (const key of Object.keys(settings.modelThinkingLevels)) {
      if (!keys.has(key)) {
        const [provider, ...rest] = key.split('/')
        const id = rest.join('/')
        extras.push({
          provider: provider ?? '',
          id,
          name: id,
          thinkingLevels: [...THINKING_LEVELS],
        })
        keys.add(key)
      }
    }
    return [...available, ...extras]
  }, [available, settings.defaultProvider, settings.defaultModel, settings.modelThinkingLevels])

  const overridesList = Object.entries(settings.modelThinkingLevels)

  const defaultModelInfo = options.find(
    (item) => item.provider === settings.defaultProvider && item.id === settings.defaultModel,
  )
  const defaultModelLevels = defaultModelInfo?.thinkingLevels ?? THINKING_LEVELS

  return (
    <div className="flex flex-col gap-8 pb-12">
      <SettingSection title="Default model & reasoning">
        <SettingCard>
          <SettingRow title="Default model">
            <ModelPickerDropdown
              models={options}
              value={defaultKey}
              onChange={(_key, nextModel) => {
                const nextLevels = nextModel.thinkingLevels ?? THINKING_LEVELS
                const nextLevel =
                  settings.defaultThinkingLevel &&
                  nextLevels.includes(settings.defaultThinkingLevel)
                    ? settings.defaultThinkingLevel
                    : nextLevels.includes('high')
                      ? 'high'
                      : (nextLevels[0] ?? 'off')
                onPatch({
                  defaultProvider: nextModel.provider,
                  defaultModel: nextModel.id,
                  defaultThinkingLevel: nextLevel,
                })
              }}
            />
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
              <SelectTrigger variant="ghost" size="sm" className="gap-1.5 px-2 text-xs font-normal">
                <LabeledSelectValue labels={THINKING_LEVEL_LABELS} />
              </SelectTrigger>
              <SelectContent align="end" className="w-auto min-w-36 text-xs">
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
              const modelInfo = options.find((m) => m.provider === provider && m.id === id)
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
                      <SelectTrigger
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 px-2 text-xs font-normal"
                      >
                        <LabeledSelectValue labels={THINKING_LEVEL_LABELS} />
                      </SelectTrigger>
                      <SelectContent align="end" className="w-auto min-w-36 text-xs">
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
      <ModelPickerDropdown
        models={unused}
        value={key}
        onChange={(newKey) => setKey(newKey)}
        placeholder={unused.length === 0 ? 'All models configured' : 'Select model…'}
        disabled={unused.length === 0}
      />
      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={resolvedLevel}
          disabled={!key}
          onValueChange={(value) => value && setLevel(value as ThinkingLevel)}
        >
          <SelectTrigger variant="ghost" size="sm" className="gap-1.5 px-2 text-xs font-normal">
            <LabeledSelectValue labels={THINKING_LEVEL_LABELS} />
          </SelectTrigger>
          <SelectContent align="end" className="w-auto min-w-36 text-xs">
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
