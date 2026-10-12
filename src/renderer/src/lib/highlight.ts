import { bundledLanguages, getSingletonHighlighter, type BundledLanguage } from 'shiki'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

const engine = createJavaScriptRegexEngine({ forgiving: true })
const THEMES = ['github-light', 'github-dark'] as const

export type HighlightToken = {
  content: string
  color?: string
  htmlStyle?: Record<string, string>
  htmlAttrs?: Record<string, string>
}

export type HighlightResult = { tokens: HighlightToken[][] }

const CACHE_LIMIT = 200
const cache = new Map<string, Promise<HighlightResult>>()

function langId(language: string): string {
  const id = language.trim().toLowerCase()
  if (!id || id === 'text' || id === 'plaintext' || id === 'txt' || id === 'plain') return 'text'
  return id in bundledLanguages ? id : 'text'
}

export function highlight(source: string, language: string): Promise<HighlightResult> {
  const lang = langId(language)
  const key = `${lang}\0${source}`
  const hit = cache.get(key)
  if (hit) {
    // Refresh recency so code still on screen isn't evicted and re-suspended.
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const task = tokenize(source, lang)
  // Streaming code caches every prefix; drop the least recently used so the cache stays bounded.
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  cache.set(key, task)
  return task
}

async function tokenize(source: string, lang: string): Promise<HighlightResult> {
  const highlighter = await getSingletonHighlighter({
    themes: [...THEMES],
    langs: lang === 'text' ? [] : [lang as BundledLanguage],
    engine,
  })
  if (lang !== 'text' && !highlighter.getLoadedLanguages().includes(lang)) {
    await highlighter.loadLanguage(lang as BundledLanguage)
  }
  return highlighter.codeToTokens(source, {
    lang: lang as BundledLanguage,
    themes: { light: THEMES[0], dark: THEMES[1] },
  })
}
