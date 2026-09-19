import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resizeImage } from '@earendil-works/pi-coding-agent'

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
}

const MAX_RAW_BYTES = 4.5 * 1024 * 1024

export async function saveClipboardImage(data: Uint8Array, mimeType: string): Promise<string> {
  const resized = await resizeImage(data, mimeType)
  if (resized) {
    const path = tmpPath(resized.mimeType)
    writeFileSync(path, Buffer.from(resized.data, 'base64'))
    return path
  }
  if (data.byteLength > MAX_RAW_BYTES) throw new Error('Image too large')
  const path = tmpPath(mimeType)
  writeFileSync(path, data)
  return path
}

function tmpPath(mimeType: string): string {
  const ext = MIME_EXT[mimeType] ?? 'png'
  return join(tmpdir(), `pi-ui-clipboard-${randomUUID()}.${ext}`)
}
