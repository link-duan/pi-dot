import { tokenQuery } from './token-query'

export function atQuery(textBeforeCaret: string): string | null {
  return tokenQuery(textBeforeCaret, '@')
}
