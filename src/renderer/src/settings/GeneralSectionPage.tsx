import { ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import type { ModelInfo } from '@shared/protocol'
import {
  GENERAL_FIELDS,
  type GeneralField,
  type GeneralKey,
  type GeneralSection,
  type GeneralSettings,
  type GeneralChange,
  type GeneralSettingsState,
  type SettingsScope,
} from '@shared/settings'
import { ModelPickerDropdown } from '@/components/ModelPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ScopedRow } from './components/ScopedRow'
import { SettingCard, SettingSection } from './components/SettingCard'
import { LabeledSelectValue } from './fields'

interface FieldUi {
  label: string
  description?: string
  group: string
  options?: Record<string, string>
}

const FIELD_UI: Record<GeneralKey, FieldUi> = {
  compactionEnabled: {
    label: 'Auto-compact context',
    description: 'Summarize older transcript context when nearing limits',
    group: 'Agent behavior',
  },
  retryEnabled: {
    label: 'Auto-retry on error',
    description: 'Retry on transient provider errors',
    group: 'Agent behavior',
  },
  enableSkillCommands: {
    label: 'Skill command shortcuts',
    description: 'Register skills as /skill:name quick commands',
    group: 'Agent behavior',
  },
  autoGenerateSessionTitleEnabled: {
    label: 'Auto-generate session titles',
    description: 'Name new sessions from the first message',
    group: 'Session title',
  },
  autoGenerateSessionTitleModel: { label: 'Title model', group: 'Session title' },
  hideThinking: {
    label: 'Hide thinking process',
    description: 'Hide chain-of-thought blocks in the transcript',
    group: 'Display & transcript',
  },
  showCacheMissNotices: {
    label: 'Prompt cache miss notices',
    description: 'Display diagnostics when cache misses occur',
    group: 'Display & transcript',
  },
  autoResizeImages: {
    label: 'Auto-resize images',
    description: 'Downscale attachments to 2000×2000',
    group: 'Multimodal & images',
  },
  blockImages: {
    label: 'Block images',
    description: 'Never transmit image attachments to models',
    group: 'Multimodal & images',
  },
  steeringMode: {
    label: 'Steering mode',
    description: 'How messages sent while the agent works are delivered',
    group: 'Message delivery',
    options: { 'one-at-a-time': 'One at a time', all: 'All at once' },
  },
  followUpMode: {
    label: 'Follow-up mode',
    description: 'How queued follow-up messages are delivered',
    group: 'Message delivery',
    options: { 'one-at-a-time': 'One at a time', all: 'All at once' },
  },
  transport: {
    label: 'Transport protocol',
    group: 'Connection',
    options: {
      auto: 'Auto',
      sse: 'SSE',
      websocket: 'WebSocket',
      'websocket-cached': 'WebSocket (cached)',
    },
  },
  httpIdleTimeoutMs: { label: 'HTTP idle timeout', group: 'Connection' },
  defaultProjectTrust: {
    label: 'Default project trust',
    description: 'Whether to load a folder’s own extensions, settings and skills',
    group: 'Project trust',
    options: { ask: 'Ask each time', always: 'Always trust', never: 'Never trust' },
  },
}

export function GeneralSectionPage({
  section,
  state,
  scope,
  available,
  onPatch,
  onScope,
}: {
  section: GeneralSection
  state: GeneralSettingsState
  scope: SettingsScope
  available: ModelInfo[]
  onPatch: (change: GeneralChange) => void
  onScope: (scope: SettingsScope) => void
}) {
  const overrides = state.workspace?.overrides ?? {}
  const inWorkspace = scope === 'workspace' && !!state.workspace
  const values: GeneralSettings = inWorkspace ? { ...state.user, ...overrides } : state.user
  const fields = GENERAL_FIELDS.filter(
    (field) =>
      field.section === section &&
      (field.key !== 'autoGenerateSessionTitleModel' || values.autoGenerateSessionTitleEnabled),
  )
  const groups = [...new Set(fields.map((field) => FIELD_UI[field.key].group))]

  return (
    <div className="flex flex-col gap-8 pb-12">
      {inWorkspace && !state.workspace?.trusted ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-foreground">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>This folder isn’t trusted; workspace settings won’t apply until you trust it.</span>
        </div>
      ) : null}
      {groups.map((group) => (
        <SettingSection key={group} title={group}>
          <SettingCard>
            {fields
              .filter((field) => FIELD_UI[field.key].group === group)
              .map((field) => {
                const ui = FIELD_UI[field.key]
                const locked = inWorkspace && !!field.userOnly
                return (
                  <ScopedRow
                    key={field.key}
                    title={ui.label}
                    description={ui.description}
                    scope={inWorkspace ? 'workspace' : 'user'}
                    userOnly={field.userOnly}
                    overridden={field.key in overrides}
                    onReset={() => onPatch({ scope: 'workspace', patch: { [field.key]: null } })}
                    onShowWorkspace={() => onScope('workspace')}
                  >
                    <FieldControl
                      field={field}
                      ui={ui}
                      value={values[field.key]}
                      disabled={locked}
                      available={available}
                      onChange={(value) => {
                        const patch = { [field.key]: value }
                        onPatch(
                          inWorkspace ? { scope: 'workspace', patch } : { scope: 'user', patch },
                        )
                      }}
                    />
                  </ScopedRow>
                )
              })}
          </SettingCard>
        </SettingSection>
      ))}
    </div>
  )
}

function FieldControl({
  field,
  ui,
  value,
  disabled,
  available,
  onChange,
}: {
  field: GeneralField
  ui: FieldUi
  value: GeneralSettings[GeneralKey]
  disabled: boolean
  available: ModelInfo[]
  onChange: (value: GeneralSettings[GeneralKey]) => void
}) {
  if (field.key === 'autoGenerateSessionTitleModel') {
    const model = value as string
    return (
      <div className="flex items-center gap-1">
        {model && !disabled ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => onChange('')}
          >
            Reset
          </Button>
        ) : null}
        <ModelPickerDropdown
          models={available}
          value={model}
          placeholder="Same as session model"
          disabled={disabled}
          onChange={(key) => onChange(key)}
        />
      </div>
    )
  }
  if (field.type === 'boolean') {
    return (
      <Switch
        aria-label={ui.label}
        checked={value as boolean}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    )
  }
  if (field.type === 'number') {
    return <MillisecondsInput value={value as number} disabled={disabled} onCommit={onChange} />
  }
  if (ui.options) {
    const options = ui.options
    return (
      <Select
        value={value as string}
        disabled={disabled}
        onValueChange={(next) => {
          if (next) onChange(next as GeneralSettings[GeneralKey])
        }}
      >
        <SelectTrigger aria-label={ui.label} className="w-44">
          <LabeledSelectValue labels={options} />
        </SelectTrigger>
        <SelectContent align="end">
          {Object.entries(options).map(([option, label]) => (
            <SelectItem key={option} value={option}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  return null
}

function MillisecondsInput({
  value,
  disabled,
  onCommit,
}: {
  value: number
  disabled: boolean
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  function commit(): void {
    if (draft === null) return
    const next = Number(draft)
    if (Number.isFinite(next) && next >= 0 && next !== value) onCommit(next)
    setDraft(null)
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        step={1000}
        disabled={disabled}
        className="w-32 text-right text-xs"
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      <span className="text-xs text-muted-foreground">ms</span>
    </div>
  )
}
