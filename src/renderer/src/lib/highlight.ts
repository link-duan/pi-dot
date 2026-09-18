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

const cache = new Map<string, HighlightResult>()
const inflight = new Map<string, Promise<HighlightResult>>()

function langId(language: string): string {
  const id = language.trim().toLowerCase()
  if (!id || id === 'text' || id === 'plaintext' || id === 'txt' || id === 'plain') return 'text'
  return id in bundledLanguages ? id : 'text'
}

export function highlight(
  source: string,
  language: string,
): HighlightResult | Promise<HighlightResult> {
  const lang = langId(language)
  const key = `${lang}\0${source}`
  const hit = cache.get(key)
  if (hit) return hit
  const pending = inflight.get(key)
  if (pending) return pending
  const task = tokenize(source, lang).then((result) => {
    cache.set(key, result)
    return result
  })
  inflight.set(key, task)
  void task.finally(() => inflight.delete(key))
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
