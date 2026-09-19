export type UserSegment = { type: 'text'; text: string } | { type: 'skill'; name: string }

const SKILL_BLOCK =
  /^<skill name="([^"]+)" location="([^"]+)">\n([\s\S]*?)\n<\/skill>(?:\n\n([\s\S]+))?$/

const INLINE_SKILL = /\/skill:([^\s]+)/g

export function parseUserSegments(text: string): UserSegment[] {
  const block = text.match(SKILL_BLOCK)
  if (block) {
    const segments: UserSegment[] = [{ type: 'skill', name: block[1]! }]
    const rest = block[4]?.trim()
    if (rest) segments.push({ type: 'text', text: rest })
    return segments
  }

  const segments: UserSegment[] = []
  let last = 0
  for (const match of text.matchAll(INLINE_SKILL)) {
    const index = match.index ?? 0
    if (index > last) segments.push({ type: 'text', text: text.slice(last, index) })
    segments.push({ type: 'skill', name: match[1]! })
    last = index + match[0].length
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) })
  return segments
}

export function keyedUserSegments(text: string): Array<UserSegment & { key: string }> {
  const seen = new Map<string, number>()
  return parseUserSegments(text).map((segment) => {
    const base = segment.type === 'skill' ? `skill:${segment.name}` : `text:${segment.text}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return { ...segment, key: `${base}:${n}` }
  })
}
