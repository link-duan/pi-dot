import { stat } from 'node:fs/promises'

export async function statPaths(
  paths: string[],
): Promise<Array<{ path: string; isDirectory: boolean }>> {
  const out: Array<{ path: string; isDirectory: boolean }> = []
  for (const path of paths) {
    if (typeof path !== 'string' || !path) continue
    try {
      const info = await stat(path)
      out.push({ path, isDirectory: info.isDirectory() })
    } catch (error) {
      console.debug('Failed to stat path', path, error)
    }
  }
  return out
}
