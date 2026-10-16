import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { buildPlan } from './build-plan'

export function BuildButton({
  className,
  size = 'sm',
}: {
  className?: string
  size?: 'sm' | 'default'
}) {
  return (
    <Button
      type="button"
      size={size}
      className={cn('bg-plan text-background hover:bg-plan/90', className)}
      onClick={buildPlan}
    >
      Build
      <Kbd className="bg-transparent px-0 text-background/60">⌘⏎</Kbd>
    </Button>
  )
}
