import { Lexer, type Tokens } from 'marked'
import { parsePlan } from '@shared/plan-file'
import { PLAN_APPROVED_PROMPT } from '@shared/protocol'

/** An inline comment on the plan, anchored to a range of the plan body's Markdown source. */
export interface PlanComment {
  id: string
  /** Serialized like a prompt: skill and file chips become `/skill:` and file tokens. */
  text: string
  start: number
  end: number
  /** `body.slice(start, end)` when the comment was made; re-anchors it after the plan changes. */
  quote: string
  /** The quote can no longer be found in the plan. */
  outdated?: boolean
}

/** 1-based line of `offset` in `text`. */
function lineAt(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length
}

/** Section headings with their offsets; lexed, so `#` lines in code don't count. */
function headings(body: string): { start: number; text: string }[] {
  const found: { start: number; text: string }[] = []
  let cursor = 0
  for (const token of Lexer.lex(body, { gfm: true })) {
    if (token.type === 'heading')
      found.push({ start: cursor, text: (token as Tokens.Heading).text })
    cursor += token.raw.length
  }
  return found
}

/** Where a comment sits: plan file lines, and the section heading it falls under. */
function locate(
  comment: PlanComment,
  body: string,
  bodyLine: number,
  sections: { start: number; text: string }[],
): string {
  if (comment.outdated) return 'Outdated (this text is no longer in the plan)'
  const first = bodyLine + lineAt(body, comment.start) - 1
  const last = bodyLine + lineAt(body, comment.end - 1) - 1
  const lines = first === last ? `Line ${first}` : `Lines ${first}-${last}`
  const heading = sections.filter((section) => section.start <= comment.start).at(-1)?.text
  return heading ? `${lines}, under "${heading}"` : lines
}

const indent = (text: string, prefix: string) =>
  text
    .split('\n')
    .map((line) => prefix + line)
    .join('\n')

/** A numbered list in document order; each item says where it is and quotes what it is about. */
function formatInline(comments: PlanComment[], plan: string): string {
  const { body, bodyLine } = parsePlan(plan)
  const sections = headings(body)
  return [...comments]
    .sort((a, b) => a.start - b.start)
    .map(
      (comment, index) =>
        `${index + 1}. ${locate(comment, body, bodyLine, sections)}\n${indent(comment.quote, '   > ')}\n${indent(comment.text, '   ')}`,
    )
    .join('\n\n')
}

/** The inline comments, then the general note after a rule. */
export function formatPlanFeedback(comments: PlanComment[], note: string, plan: string): string {
  const parts: string[] = []
  if (comments.length > 0) parts.push(formatInline(comments, plan))
  if (note.trim()) parts.push(note.trim())
  return parts.join('\n\n---\n\n')
}

export function formatApproval(comments: PlanComment[], plan: string): string {
  if (comments.length === 0) return PLAN_APPROVED_PROMPT
  return `${PLAN_APPROVED_PROMPT} Also address these comments:\n\n${formatInline(comments, plan)}`
}

/** Moves comments to where their quote now is (the occurrence nearest the old spot), or marks them outdated. */
export function reanchor(comments: PlanComment[], body: string): PlanComment[] {
  let changed = false
  const next = comments.map((comment) => {
    if (body.slice(comment.start, comment.end) === comment.quote) {
      if (!comment.outdated) return comment
      changed = true
      return { ...comment, outdated: false }
    }
    const start = nearestIndex(body, comment.quote, comment.start)
    if (start < 0 && comment.outdated) return comment
    changed = true
    if (start < 0) return { ...comment, outdated: true }
    return { ...comment, start, end: start + comment.quote.length, outdated: false }
  })
  return changed ? next : comments
}

function nearestIndex(text: string, needle: string, near: number): number {
  let best = -1
  for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
    if (best < 0 || Math.abs(at - near) < Math.abs(best - near)) best = at
  }
  return best
}
