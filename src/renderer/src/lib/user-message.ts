import { matchFileTokens, type FileRange } from './file-token'

export type UserSegment =
  | { type: 'text'; text: string }
  | { type: 'skill'; name: string }
  | { type: 'file'; path: string; range?: FileRange }

const SKILL_BLOCK =
  /^<skill name="([^"]+)" location="([^"]+)">\n([\s\S]*?)\n<\/skill>(?:\n\n([\s\S]+))?$/

const INLINE_SKILL = /\/skill:([^\s]+)/g

export function parseUserSegments(text: string): UserSegment[] {
  const block = text.match(SKILL_BLOCK)
  if (block) {
    const segments: UserSegment[] = [{ type: 'skill', name: block[1]! }]
    const rest = block[4]?.trim()
    if (rest) segments.push(...parseInlineSegments(rest))
    return segments
  }
  return parseInlineSegments(text)
}

export function keyedUserSegments(text: string): Array<UserSegment & { key: string }> {
  const seen = new Map<string, number>()
  return parseUserSegments(text).map((segment) => {
    const base =
      segment.type === 'skill'
        ? `skill:${segment.name}`
        : segment.type === 'file'
          ? `file:${segment.path}:${segment.range?.start ?? ''}-${segment.range?.end ?? ''}`
          : `text:${segment.text}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return { ...segment, key: `${base}:${n}` }
  })
}

function parseInlineSegments(text: string): UserSegment[] {
  type Token = { index: number; length: number; segment: UserSegment }
  const tokens: Token[] = []
  for (const match of text.matchAll(INLINE_SKILL)) {
    tokens.push({
      index: match.index ?? 0,
      length: match[0].length,
      segment: { type: 'skill', name: match[1]! },
    })
  }
  for (const match of matchFileTokens(text)) {
    tokens.push({
      index: match.index,
      length: match.length,
      segment: { type: 'file', path: match.ref.path, range: match.ref.range },
    })
  }
  tokens.sort((a, b) => a.index - b.index)

  const kept: Token[] = []
  let cursor = 0
  for (const token of tokens) {
    if (token.index < cursor) continue
    kept.push(token)
    cursor = token.index + token.length
  }

  const segments: UserSegment[] = []
  let last = 0
  for (const token of kept) {
    if (token.index > last) segments.push({ type: 'text', text: text.slice(last, token.index) })
    segments.push(token.segment)
    last = token.index + token.length
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) })
  return segments
}
