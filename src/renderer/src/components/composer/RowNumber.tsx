export function RowNumber({ value }: { value: number }) {
  return <span className="w-3 shrink-0 text-xs text-muted-foreground tabular-nums">{value}</span>
}
