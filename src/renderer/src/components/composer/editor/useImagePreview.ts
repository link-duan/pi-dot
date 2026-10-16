import { useEffect, useState } from 'react'
import type { ImagePreview } from '@shared/api'

// Chips re-mount as the editor and transcript re-render; read each image once.
const cache = new Map<string, Promise<ImagePreview | null>>()

/** Downscaled preview of an image file-chip path; null while loading or when unreadable. */
export function useImagePreview(path: string | null): ImagePreview | null {
  const [preview, setPreview] = useState<{ path: string; image: ImagePreview | null } | null>(null)

  useEffect(() => {
    if (!path) return
    let request = cache.get(path)
    if (!request) {
      request = window.pi.imagePreview(path).catch(() => null)
      cache.set(path, request)
    }
    let cancelled = false
    void request.then((image) => {
      if (!cancelled) setPreview({ path, image })
    })
    return () => {
      cancelled = true
    }
  }, [path])

  return preview?.path === path ? preview.image : null
}
