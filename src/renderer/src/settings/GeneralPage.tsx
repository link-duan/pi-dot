import { useState } from 'react'
import type { AppSettings, DeliveryMode, ProjectTrust, TransportSetting } from '@shared/settings'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { SettingCard, SettingRow, SettingSection } from './components/SettingCard'
import { LabeledSelectValue, ToggleRow } from './fields'

const TRANSPORTS: Array<{ value: TransportSetting; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'sse', label: 'SSE' },
  { value: 'websocket', label: 'WebSocket' },
  { value: 'websocket-cached', label: 'WebSocket (cached)' },
]

const DELIVERY: Array<{ value: DeliveryMode; label: string }> = [
  { value: 'one-at-a-time', label: 'One at a time' },
  { value: 'all', label: 'All at once' },
]

const TRUST: Array<{ value: ProjectTrust; label: string }> = [
  { value: 'ask', label: 'Ask each time' },
  { value: 'always', label: 'Always trust' },
  { value: 'never', label: 'Never trust' },
]

export function GeneralPage({
  settings,
  onPatch,
}: {
  settings: AppSettings
  onPatch: (patch: Partial<AppSettings>) => void
}) {
  return (
    <div className="flex flex-col gap-8 pb-12">
      <SettingSection title="Agent behavior">
        <SettingCard>
          <ToggleRow
            label="Auto-compact context"
            description="Summarize older transcript context when nearing limits"
            checked={settings.compactionEnabled}
            onChange={(compactionEnabled) => onPatch({ compactionEnabled })}
          />
          <ToggleRow
            label="Auto-retry on error"
            description="Retry on transient provider errors"
            checked={settings.retryEnabled}
            onChange={(retryEnabled) => onPatch({ retryEnabled })}
          />
          <ToggleRow
            label="Skill command shortcuts"
            description="Register skills as /skill:name quick commands"
            checked={settings.enableSkillCommands}
            onChange={(enableSkillCommands) => onPatch({ enableSkillCommands })}
          />
        </SettingCard>
      </SettingSection>

      <SettingSection title="Multimodal & images">
        <SettingCard>
          <ToggleRow
            label="Auto-resize images"
            description="Downscale attachments to 2000×2000"
            checked={settings.autoResizeImages}
            onChange={(autoResizeImages) => onPatch({ autoResizeImages })}
          />
          <ToggleRow
            label="Block images"
            description="Never transmit image attachments to models"
            checked={settings.blockImages}
            onChange={(blockImages) => onPatch({ blockImages })}
          />
        </SettingCard>
      </SettingSection>

      <SettingSection title="Display & transcript">
        <SettingCard>
          <ToggleRow
            label="Hide thinking process"
            description="Hide chain-of-thought blocks in the transcript"
            checked={settings.hideThinking}
            onChange={(hideThinking) => onPatch({ hideThinking })}
          />
          <ToggleRow
            label="Prompt cache miss notices"
            description="Display diagnostics when cache misses occur"
            checked={settings.showCacheMissNotices}
            onChange={(showCacheMissNotices) => onPatch({ showCacheMissNotices })}
          />
        </SettingCard>
      </SettingSection>

      <SettingSection title="Network & execution">
        <SettingCard>
          <SettingRow title="Steering mode">
            <Select
              value={settings.steeringMode}
              onValueChange={(value) => {
                if (value) onPatch({ steeringMode: value as DeliveryMode })
              }}
            >
              <SelectTrigger className="w-44">
                <LabeledSelectValue
                  labels={Object.fromEntries(DELIVERY.map((item) => [item.value, item.label]))}
                />
              </SelectTrigger>
              <SelectContent align="end">
                {DELIVERY.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow title="Follow-up mode">
            <Select
              value={settings.followUpMode}
              onValueChange={(value) => {
                if (value) onPatch({ followUpMode: value as DeliveryMode })
              }}
            >
              <SelectTrigger className="w-44">
                <LabeledSelectValue
                  labels={Object.fromEntries(DELIVERY.map((item) => [item.value, item.label]))}
                />
              </SelectTrigger>
              <SelectContent align="end">
                {DELIVERY.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow title="Transport protocol">
            <Select
              value={settings.transport}
              onValueChange={(value) => {
                if (value) onPatch({ transport: value as TransportSetting })
              }}
            >
              <SelectTrigger className="w-44">
                <LabeledSelectValue
                  labels={Object.fromEntries(TRANSPORTS.map((item) => [item.value, item.label]))}
                />
              </SelectTrigger>
              <SelectContent align="end">
                {TRANSPORTS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow title="HTTP idle timeout">
            <HttpIdleTimeout
              value={settings.httpIdleTimeoutMs}
              onCommit={(httpIdleTimeoutMs) => onPatch({ httpIdleTimeoutMs })}
            />
          </SettingRow>
        </SettingCard>
      </SettingSection>

      <SettingSection title="Security & project trust">
        <SettingCard>
          <SettingRow title="Default project trust">
            <Select
              value={settings.defaultProjectTrust}
              onValueChange={(value) => {
                if (value) onPatch({ defaultProjectTrust: value as ProjectTrust })
              }}
            >
              <SelectTrigger className="w-44">
                <LabeledSelectValue
                  labels={Object.fromEntries(TRUST.map((item) => [item.value, item.label]))}
                />
              </SelectTrigger>
              <SelectContent align="end">
                {TRUST.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        </SettingCard>
      </SettingSection>
    </div>
  )
}

function HttpIdleTimeout({
  value,
  onCommit,
}: {
  value: number
  onCommit: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setText(String(value))
  }

  function commit(): void {
    const next = Number(text)
    if (Number.isFinite(next) && next >= 0) {
      if (next !== value) onCommit(next)
      return
    }
    setText(String(value))
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        step={1000}
        className="w-32 text-right text-xs"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      <span className="text-xs text-muted-foreground">ms</span>
    </div>
  )
}
