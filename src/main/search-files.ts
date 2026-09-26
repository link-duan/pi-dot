import { spawn, spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { FileHit } from '@shared/protocol'

const SKIP = new Set(['.git', 'node_modules', 'dist', 'out'])
const MAX_FD = 100
const MAX_VISIBLE = 20

let fdBin: string | null | undefined
let fdChild: ReturnType<typeof spawn> | null = null

export function scoreFileHit(path: string, query: string, isDirectory: boolean): number {
  if (!query) return 1
  const fileName = basename(path.replace(/\/+$/, '')).toLowerCase()
  const needle = query.toLowerCase()
  let score = 0
  if (fileName === needle) score = 100
  else if (fileName.startsWith(needle)) score = 80
  else if (fileName.includes(needle)) score = 50
  else if (path.toLowerCase().includes(needle)) score = 30
  if (isDirectory && score > 0) score += 10
  return score
}

export function rankFileHits(hits: FileHit[], query: string): FileHit[] {
  const needle = queryTail(query)
  const scored = hits
    .map((hit) => ({ hit, score: scoreFileHit(hit.path, needle, hit.isDirectory) }))
    .filter((item) => item.score > 0)
  scored.sort((a, b) => {
    const scoreDiff = b.score - a.score
    if (scoreDiff !== 0) return scoreDiff
    const aDepth = a.hit.path.split('/').filter(Boolean).length
    const bDepth = b.hit.path.split('/').filter(Boolean).length
    if (aDepth !== bDepth) return aDepth - bDepth
    if (a.hit.path.length !== b.hit.path.length) return a.hit.path.length - b.hit.path.length
    return a.hit.path.localeCompare(b.hit.path)
  })
  return scored.slice(0, MAX_VISIBLE).map((item) => item.hit)
}

export async function searchProjectFiles(cwd: string, query: string): Promise<FileHit[]> {
  if (!cwd) return []
  const fd = resolveFd()
  const hits = fd ? await searchWithFd(fd, cwd, query) : walkFallback(cwd, query)
  return rankFileHits(hits, query)
}

function queryTail(query: string): string {
  const posix = query.replace(/\\/g, '/')
  const index = posix.lastIndexOf('/')
  return index === -1 ? posix : posix.slice(index + 1)
}

function queryPrefix(query: string): string {
  const posix = query.replace(/\\/g, '/')
  const index = posix.lastIndexOf('/')
  return index === -1 ? '' : posix.slice(0, index + 1)
}

/** skip = outside the @src/ scope; descend = ancestor dir of the scope; keep = list it */
export function walkScope(
  path: string,
  isDirectory: boolean,
  prefix: string,
): 'skip' | 'descend' | 'keep' {
  if (!prefix) return 'keep'
  const dir = `${path}/`
  const inside = dir.startsWith(prefix) || path.startsWith(prefix)
  const ancestor = prefix.startsWith(dir)
  if (!inside && !ancestor) return 'skip'
  if (isDirectory && ancestor && !inside) return 'descend'
  return 'keep'
}

function resolveFd(): string | null {
  if (fdBin !== undefined) return fdBin
  for (const cmd of ['fd', 'fdfind']) {
    try {
      const result = spawnSync(cmd, ['--version'], { stdio: 'pipe' })
      if (!result.error && result.status === 0) {
        fdBin = cmd
        return cmd
      }
    } catch (error) {
      console.debug('Failed to probe file search command', cmd, error)
    }
  }
  fdBin = null
  return null
}

function fdQuery(query: string): string {
  const normalized = query.replace(/\\/g, '/')
  if (!normalized.includes('/')) return normalized
  const trailing = normalized.endsWith('/')
  const trimmed = normalized.replace(/^\/+|\/+$/g, '')
  if (!trimmed) return normalized
  const pattern = trimmed
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\\\/]')
  return trailing ? `${pattern}[\\\\/]` : pattern
}

function searchWithFd(fd: string, cwd: string, query: string): Promise<FileHit[]> {
  const args = [
    '--base-directory',
    cwd,
    '--max-results',
    String(MAX_FD),
    '--type',
    'f',
    '--type',
    'd',
    '--follow',
    '--hidden',
    '--no-require-git',
    '--exclude',
    '.git',
  ]
  if (query.includes('/')) args.push('--full-path')
  if (query) args.push('--', fdQuery(query))

  return new Promise((resolve) => {
    fdChild?.kill('SIGKILL')
    const child = spawn(fd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    fdChild = child
    let stdout = ''
    const finish = (hits: FileHit[]) => {
      if (fdChild === child) fdChild = null
      resolve(hits)
    }
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.on('error', () => finish([]))
    child.on('close', (code) => {
      if (code !== 0 && code !== 1) {
        finish([])
        return
      }
      const hits: FileHit[] = []
      for (const line of stdout.split('\n')) {
        const path = line.replace(/\\/g, '/').replace(/\/+$/, '').trim()
        if (!path || path === '.git' || path.startsWith('.git/') || path.includes('/.git/')) {
          continue
        }
        hits.push({ path, isDirectory: isDir(join(cwd, path)) })
      }
      finish(hits)
    })
  })
}

function walkFallback(cwd: string, query: string): FileHit[] {
  const hits: FileHit[] = []
  const needle = queryTail(query).toLowerCase()
  const prefix = queryPrefix(query)

  function rec(rel: string): void {
    if (hits.length >= MAX_FD) return
    let entries
    try {
      entries = readdirSync(join(cwd, rel), { withFileTypes: true })
    } catch (error) {
      console.warn('Failed to read search directory', join(cwd, rel), error)
      return
    }
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue
      const path = rel ? `${rel}/${entry.name}` : entry.name
      const isDirectory = entry.isDirectory()
      const scope = walkScope(path, isDirectory, prefix)
      if (scope === 'skip') continue
      if (scope === 'descend') {
        rec(path)
        continue
      }
      if (!needle || scoreFileHit(path, needle, isDirectory) > 0) {
        hits.push({ path, isDirectory })
      }
      if (isDirectory) rec(path)
      if (hits.length >= MAX_FD) return
    }
  }

  rec('')
  return hits
}

function isDir(abs: string): boolean {
  try {
    return statSync(abs).isDirectory()
  } catch (error) {
    console.debug('Failed to inspect search path', abs, error)
    return false
  }
}
