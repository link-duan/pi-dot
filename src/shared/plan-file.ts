import { parse } from 'yaml'

export interface ParsedPlan {
  name: string
  overview: string
  /** The Markdown after the frontmatter. */
  body: string
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

/** Splits a Plan File into its `name` / `overview` frontmatter and Markdown body. */
export function parsePlan(text: string): ParsedPlan {
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
    body: match ? text.slice(match[0].length).trim() : text,
  }
}
