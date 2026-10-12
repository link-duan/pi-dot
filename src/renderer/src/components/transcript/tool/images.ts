import { asRecord, pathField } from '@/lib/format'

export interface ToolImageItem {
  src: string
  mimeType: string
  path?: string
  title?: string
}

export interface ToolImageTextMeta {
  notice?: string
  description?: string
}

function extractImageBlock(block: unknown): { data: string; mimeType: string } | null {
  if (!block || typeof block !== 'object') return null
  const b = block as Record<string, unknown>
  if (b.type === 'image' && typeof b.data === 'string' && b.data) {
    return { data: b.data, mimeType: typeof b.mimeType === 'string' ? b.mimeType : 'image/png' }
  }
  return null
}

function collectImageBlocks(
  root: unknown,
  items: ToolImageItem[],
  seen: Set<string>,
  path?: string,
) {
  if (!root || typeof root !== 'object') return

  const extracted = extractImageBlock(root)
  if (extracted) {
    const src = extracted.data.startsWith('data:')
      ? extracted.data
      : `data:${extracted.mimeType};base64,${extracted.data}`
    const key = src.slice(0, 128)
    if (!seen.has(key)) {
      seen.add(key)
      items.push({
        src,
        mimeType: extracted.mimeType,
        ...(path ? { path } : {}),
      })
    }
    return
  }

  if (Array.isArray(root)) {
    for (const item of root) {
      collectImageBlocks(item, items, seen, path)
    }
    return
  }

  const rec = root as Record<string, unknown>

  // 1. Standard protocol content block array
  if (Array.isArray(rec.content)) {
    for (const item of rec.content) {
      collectImageBlocks(item, items, seen, path)
    }
  }

  // 2. MCP details.raw.content (e.g. figma_get_screenshot)
  const details = asRecord(rec.details)
  const raw = asRecord(details?.raw)
  if (Array.isArray(raw?.content)) {
    for (const item of raw.content) {
      collectImageBlocks(item, items, seen, path)
    }
  }
}

export function extractToolImages(
  result: unknown,
  args?: unknown,
  cwd?: string | null,
  home?: string | null,
): ToolImageItem[] {
  if (!result || typeof result !== 'object') return []
  const items: ToolImageItem[] = []
  const seen = new Set<string>()
  const record = asRecord(args)
  const path = record ? pathField(record, cwd, home) : ''

  collectImageBlocks(result, items, seen, path)
  return items
}

function extractTextBlocks(result: unknown): string[] {
  if (!result || typeof result !== 'object') {
    return typeof result === 'string' && result.trim() ? [result] : []
  }
  const texts: string[] = []
  const content = 'content' in result ? (result as { content: unknown }).content : result
  if (Array.isArray(content)) {
    for (const b of content) {
      if (
        b &&
        typeof b === 'object' &&
        'type' in b &&
        b.type === 'text' &&
        typeof (b as { text?: unknown }).text === 'string'
      ) {
        texts.push((b as { text: string }).text)
      }
    }
  } else if (typeof content === 'string') {
    texts.push(content)
  }
  return texts
}

export function resolveToolImageText(toolName: string, result: unknown): ToolImageTextMeta {
  const isRead = toolName.toLowerCase() === 'read'
  const textBlocks = extractTextBlocks(result)

  if (isRead) {
    // For read tool: line 0 is boilerplate "Read image file [...]".
    // All subsequent lines are actual engine hints (e.g. "[Image: original ...]" or "[Image resized ...]").
    const fullText = textBlocks.join('\n')
    const lines = fullText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const notice = lines.slice(1).join('\n')
    return { notice: notice || undefined, description: undefined }
  }

  // For other tools: ignore MCP placeholder "[image content: ...]", treat genuine text as description
  const descriptions = textBlocks
    .flatMap((t) => t.split('\n'))
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !t.toLowerCase().startsWith('[image content:'))

  return {
    notice: undefined,
    description: descriptions.length > 0 ? descriptions.join('\n') : undefined,
  }
}
