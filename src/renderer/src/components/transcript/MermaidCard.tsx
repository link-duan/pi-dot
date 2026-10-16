import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Code2, Eye, GitGraph, Loader2 } from 'lucide-react'
import { CodeBlockCopyButton } from 'streamdown'
import { ScrollFade } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { HighlightedCode } from './HighlightedCode'

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function MermaidCard({
  code,
  isIncomplete = false,
  className,
}: {
  code: string
  isIncomplete?: boolean
  className?: string
}) {
  const isDark = useIsDark()
  const rawId = useId()
  const instanceId = useMemo(
    () => `mermaid-${hashString(code)}-${hashString(rawId)}`,
    [code, rawId],
  )

  const [mode, setMode] = useState<'preview' | 'code'>('preview')
  const [svg, setSvg] = useState<string>('')
  const [cachedSvg, setCachedSvg] = useState<string>('')
  const [isRendering, setIsRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const renderCounter = useRef(0)

  useEffect(() => {
    const trimmed = code.trim()
    const currentRun = ++renderCounter.current
    let isMounted = true

    async function runRender() {
      if (!trimmed) {
        if (isMounted && currentRun === renderCounter.current) {
          setSvg('')
          setError(null)
          setIsRendering(false)
        }
        return
      }

      try {
        setIsRendering(true)
        const mermaidModule = await import('mermaid')
        const mermaid = mermaidModule.default

        // 官方原生标准配置：使用 classic 经典单线几何矢量，彻底关闭 Mermaid v11 默认的 neo 发光描边
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          look: 'classic',
          theme: isDark ? 'dark' : 'neutral',
          suppressErrorRendering: true,
        })

        const renderId = `${instanceId}-${Date.now()}`
        const { svg: renderedSvg } = await mermaid.render(renderId, trimmed)

        if (isMounted && currentRun === renderCounter.current) {
          setSvg(renderedSvg)
          setCachedSvg(renderedSvg)
          setError(null)
        }
      } catch (err) {
        if (!isMounted || currentRun !== renderCounter.current) return
        if (!isIncomplete && !cachedSvg && !svg) {
          setError(err instanceof Error ? err.message : 'Failed to render Mermaid diagram')
        }
      } finally {
        if (isMounted && currentRun === renderCounter.current) {
          setIsRendering(false)
        }
      }
    }

    void runRender()

    return () => {
      isMounted = false
    }
  }, [code, isDark, instanceId, isIncomplete, cachedSvg, svg])

  const activeSvg = svg || cachedSvg
  const showCode = mode === 'code' || (!activeSvg && (isIncomplete || error !== null))

  return (
    <div data-wide="" className={cn('mt-2 w-full rounded-xl border border-border pt-2', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 pb-2">
        <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <GitGraph className="size-3.5" />
          <span>mermaid</span>
          {isIncomplete && (
            <span className="ml-1 flex items-center gap-1 text-[11px] text-subtle-foreground">
              <Loader2 className="size-3 animate-spin" />
              <span>generating</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {activeSvg && (
            <div className="flex items-center gap-0.5 rounded bg-muted/70 p-0.5">
              <button
                type="button"
                className={cn(
                  'flex size-5 cursor-pointer items-center justify-center rounded-sm transition-colors select-none',
                  mode === 'preview'
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setMode('preview')}
                aria-label="View chart"
                data-view="preview"
                title="View chart"
              >
                <Eye className="size-3" />
              </button>
              <button
                type="button"
                className={cn(
                  'flex size-5 cursor-pointer items-center justify-center rounded-sm transition-colors select-none',
                  mode === 'code'
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setMode('code')}
                aria-label="View code"
                data-view="code"
                title="View code"
              >
                <Code2 className="size-3" />
              </button>
            </div>
          )}

          <CodeBlockCopyButton code={code} />
        </div>
      </div>

      {showCode ? (
        <div>
          {error && !isIncomplete && (
            <div className="border-b border-border bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
              Mermaid syntax error: {error}
            </div>
          )}
          <ScrollFade
            className="max-h-96 py-2 font-mono text-xs leading-relaxed"
            scrollbarClassName="my-0.5"
          >
            <HighlightedCode source={code} language="mermaid" pending={isIncomplete} />
          </ScrollFade>
        </div>
      ) : (
        <div className="relative flex min-h-24 w-full items-center justify-center overflow-x-auto p-4 [&_svg]:h-auto [&_svg]:max-w-full">
          {isRendering && !activeSvg ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Rendering diagram...</span>
            </div>
          ) : (
            <div
              className="flex w-full justify-center [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: activeSvg }}
            />
          )}
        </div>
      )}
    </div>
  )
}
