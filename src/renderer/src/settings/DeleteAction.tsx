import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DeleteAction({
  pending,
  onArm,
  onConfirm,
  onCancel,
}: {
  pending: boolean
  onArm: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  if (pending) {
    return (
      <div className="flex animate-in items-center gap-1.5 duration-150 fade-in">
        <Button type="button" size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="xs" variant="destructive" onClick={onConfirm}>
          Delete
        </Button>
      </div>
    )
  }
  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      className="text-muted-foreground hover:text-destructive"
      aria-label="Delete"
      onClick={onArm}
    >
      <Trash2 className="size-3.5" />
    </Button>
  )
}
