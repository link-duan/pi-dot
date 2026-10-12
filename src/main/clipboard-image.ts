import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
}

// Saved as-is like Pi TUI: the read tool resizes images for the model when the agent reads them.
export async function saveClipboardImage(data: Uint8Array, mimeType: string): Promise<string> {
  const path = join(tmpdir(), `pi-ui-clipboard-${randomUUID()}.${MIME_EXT[mimeType] ?? 'png'}`)
  await writeFile(path, data)
  return path
}
