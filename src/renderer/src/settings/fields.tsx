import { SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SettingRow } from './components/SettingCard'

export function LabeledSelectValue({ labels }: { labels: Record<string, string> }) {
  return (
    <SelectValue>{(value: string | null) => (value ? (labels[value] ?? value) : null)}</SelectValue>
  )
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <SettingRow title={label} description={description}>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </SettingRow>
  )
}
