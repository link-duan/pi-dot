export function tokenQuery(textBeforeCaret: string, trigger: string): string | null {
  if (!trigger) return null
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = textBeforeCaret.match(new RegExp(`(?:^|\\s)(${escaped}[^\\s]*)$`))
  if (!match) return null
  return match[1]!.slice(trigger.length)
}
