import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export function TestButton({
  testing,
  onClick,
  variant = 'outline',
  className,
}: {
  testing: boolean
  onClick: () => void
  variant?: 'outline' | 'ghost'
  className?: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className={className}
      disabled={testing}
      onClick={onClick}
    >
      {testing ? <Spinner className="size-3.5" /> : null}
      {testing ? 'Testing…' : 'Test'}
    </Button>
  )
}
