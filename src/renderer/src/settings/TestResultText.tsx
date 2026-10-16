import { type ProviderTestResult } from '@shared/settings'
import { cn } from '@/lib/utils'

export function TestResultText({
  result,
  className,
}: {
  result: ProviderTestResult
  className?: string
}) {
  return (
    <span
      className={cn('block truncate', !result.ok && 'text-destructive', className)}
      title={result.ok ? undefined : result.message}
    >
      {result.ok
        ? `Connected · ${result.latencyMs} ms · ${result.model}`
        : `Connection failed · ${result.message}`}
    </span>
  )
}
