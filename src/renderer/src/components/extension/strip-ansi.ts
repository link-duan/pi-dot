import { parseAnsi } from '@/lib/ansi'

export function stripAnsi(text: string): string {
  return parseAnsi(text)
    .map((span) => span.text)
    .join('')
}
