import { parse } from 'yaml'

export interface ParsedPlan {
  name: string
  overview: string
  /** The Markdown after the frontmatter, with `\n` line endings. */
  body: string
  /** The file line (1-based) `body` starts on. */
  bodyLine: number
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/

/** Splits a Plan File into its `name` / `overview` frontmatter and Markdown body. */
export function parsePlan(raw: string): ParsedPlan {
  // Markdown parsers normalize CRLF; do it up front so offsets into `body` stay exact.
  const text = raw.replace(/\r\n?/g, '\n')
  const match = FRONTMATTER.exec(text)
  let meta: unknown
  try {
    meta = match ? parse(match[1]!) : null
  } catch {
    meta = null
  }
  const { name, overview } = (meta ?? {}) as { name?: unknown; overview?: unknown }
  return {
    name: typeof name === 'string' && name.trim() ? name.trim() : 'Plan',
    overview: typeof overview === 'string' ? overview.trim() : '',
    ...trimmed(text, match ? match[0].length : 0),
  }
}

function trimmed(text: string, from: number): Pick<ParsedPlan, 'body' | 'bodyLine'> {
  const rest = text.slice(from)
  const body = rest.trim()
  const start = from + rest.indexOf(body)
  return { body, bodyLine: text.slice(0, start).split('\n').length }
}
