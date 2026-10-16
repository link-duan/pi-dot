import { Suspense, use, type ReactNode } from 'react'
import { highlight, type HighlightToken } from '@/lib/highlight'

/** Renders `children` with the highlighted tokens of `source`, and `fallback` until they resolve. */
export function Highlighted({
  source,
  language,
  pending,
  fallback,
  children,
}: {
  source: string
  language: string
  pending?: boolean
  fallback: ReactNode
  children: (tokens: HighlightToken[][]) => ReactNode
}) {
  if (pending) return fallback
  return (
    <Suspense fallback={fallback}>
      <Resolve source={source} language={language}>
        {children}
      </Resolve>
    </Suspense>
  )
}

function Resolve({
  source,
  language,
  children,
}: {
  source: string
  language: string
  children: (tokens: HighlightToken[][]) => ReactNode
}) {
  return children(useHighlight(source, language).tokens)
}

function useHighlight(source: string, language: string) {
  return use(highlight(source, language))
}
