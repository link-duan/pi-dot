import { SelectValue } from '@/components/ui/select'

export function LabeledSelectValue({ labels }: { labels: Record<string, string> }) {
  return (
    <SelectValue>{(value: string | null) => (value ? (labels[value] ?? value) : null)}</SelectValue>
  )
}
