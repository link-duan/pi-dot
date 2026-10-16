import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { modelId, readModelForm, type JsonObject, type ModelForm } from '@shared/models-file'
import { THINKING_LEVELS } from '@shared/protocol'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { SettingCard } from '@/settings/components/SettingCard'
import { SettingRow } from '@/settings/components/SettingRow'
import { SettingSection } from '@/settings/components/SettingSection'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { LabeledSelectValue } from './fields'

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
