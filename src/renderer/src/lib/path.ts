export function folderName(cwd: string): string {
  const parts = cwd.split(/[/\\]/).filter(Boolean)
  return parts.at(-1) ?? cwd
}

function toPosix(path: string): string {
  return path.replace(/\\/g, '/')
}

function trimTrailingSlash(path: string): string {
  if (path === '/') return path
  return path.replace(/\/+$/, '')
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:\//.test(path)
}

function rootOf(path: string): string {
  const drive = path.match(/^([a-zA-Z]:)/)
  if (drive) return drive[1].toLowerCase()
  if (path.startsWith('/')) return '/'
  return ''
}

function splitPath(path: string): string[] {
  return path
    .replace(/^[a-zA-Z]:/, '')
    .split('/')
    .filter(Boolean)
}

function withHomePrefix(path: string, home?: string | null): string {
  if (!home) return path
  const base = trimTrailingSlash(toPosix(home))
  if (path === base) return '~'
  if (path.startsWith(`${base}/`)) return `~/${path.slice(base.length + 1)}`
  return path
}

function relativePath(from: string, to: string): string {
  const fromParts = splitPath(from)
  const toParts = splitPath(to)
  let i = 0
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++
  return (
    [...Array.from({ length: fromParts.length - i }, () => '..'), ...toParts.slice(i)].join('/') ||
    '.'
  )
}

export function displayPath(path: string, cwd?: string | null, home?: string | null): string {
  const posix = toPosix(path)
  const absolute = isAbsolutePath(posix) ? withHomePrefix(posix, home) : posix
  if (!cwd) return absolute

  const base = trimTrailingSlash(toPosix(cwd))
  if (posix === base) return '.'
  if (posix.startsWith(`${base}/`)) return posix.slice(base.length + 1) || '.'
  if (!isAbsolutePath(posix)) return posix
  if (rootOf(base) !== rootOf(posix)) return absolute

  const relative = relativePath(base, posix)
  return relative.length <= absolute.length ? relative : absolute
}
