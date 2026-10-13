/** Shared look of the cards above the Composer (questions, extension dialogs). */
export const CARD =
  'mb-2 w-full animate-in rounded-2xl border border-border bg-card/90 p-1.5 backdrop-blur-md duration-200 ease-out outline-none fade-in dark:bg-card/95'

export const BUTTON_RADIUS = 'rounded-[calc(var(--radius-2xl)-5px)]'

export const ROW =
  'flex w-full items-baseline gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors outline-none hover:bg-muted/50'

export function RowNumber({ value }: { value: number }) {
  return <span className="w-3 shrink-0 text-xs text-muted-foreground tabular-nums">{value}</span>
}
