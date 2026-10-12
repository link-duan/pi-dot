import { isAbsolute, join } from 'node:path'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i

/** Resolves a file-chip path (relative, `~/` or absolute) to an absolute image path. */
export function resolveImagePath(
  path: string,
  cwd: string | undefined,
  home: string,
): string | null {
  if (!IMAGE_EXT.test(path)) return null
  if (path.startsWith('~/')) return join(home, path.slice(2))
  if (isAbsolute(path)) return path
  return cwd ? join(cwd, path) : null
}
