export type ElectronFile = File & { path?: string }

export function clipboardFilePaths(clipboard: DataTransfer): string[] {
  const fromFiles = [...clipboard.files]
    .map((file) => (file as ElectronFile).path)
    .filter((path): path is string => Boolean(path))
  if (fromFiles.length > 0) return fromFiles
  const uriList = clipboard.getData('text/uri-list')
  if (!uriList) return []
  return uriList
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map(fileUrlToPath)
    .filter((path): path is string => Boolean(path))
}

export function fileUrlToPath(url: string): string | null {
  if (!url.startsWith('file:')) return null
  try {
    const parsed = new URL(url)
    let path = decodeURIComponent(parsed.pathname)
    if (/^\/[a-zA-Z]:\//.test(path)) path = path.slice(1)
    return path
  } catch (error) {
    console.debug('Failed to parse clipboard file URL', url, error)
    return null
  }
}
