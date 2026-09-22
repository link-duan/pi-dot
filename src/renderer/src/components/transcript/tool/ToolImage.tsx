import { useState } from 'react'
import { Check, Copy, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ToolImageItem } from './images'

export function ToolImage({ preview }: { preview: ToolImageItem }) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const copyImageOrPath = async () => {
    try {
      const res = await fetch(preview.src)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (preview.path) {
        await navigator.clipboard.writeText(preview.path)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  const titleText = preview.path || preview.title

  return (
    <>
      <div className="mt-2 w-full overflow-hidden rounded-xl border border-border bg-card">
        {/* Header: clean path/title & resolution */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-1.5">
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            {titleText ? (
              <Tooltip>
                <TooltipTrigger
                  render={<span />}
                  className="min-w-0 cursor-default truncate font-mono text-xs text-muted-foreground"
                >
                  {titleText}
                </TooltipTrigger>
                <TooltipContent className="max-w-lg font-mono text-xs break-all">
                  {titleText}
                </TooltipContent>
              </Tooltip>
            ) : null}
            {dimensions ? (
              <span className="shrink-0 font-mono text-[11px] whitespace-nowrap text-muted-foreground/60 tabular-nums">
                {dimensions.width} × {dimensions.height}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Preview image"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setLightboxOpen(true)}
                  />
                }
              >
                <Maximize2 className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Preview image</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Copy image"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => void copyImageOrPath()}
                  />
                }
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </TooltipTrigger>
              <TooltipContent>{copied ? 'Copied' : 'Copy image'}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Image Display: accessible button container with subtle background */}
        <button
          type="button"
          aria-label={`Preview ${titleText || 'image'}`}
          onClick={() => setLightboxOpen(true)}
          className="group/img relative flex max-h-96 min-h-36 w-full cursor-zoom-in items-center justify-center overflow-hidden bg-muted/15 p-3 transition-colors hover:bg-muted/25 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none dark:bg-muted/10 dark:hover:bg-muted/20"
        >
          <img
            src={preview.src}
            alt={titleText || 'Image preview'}
            loading="lazy"
            decoding="async"
            onLoad={(e) => {
              const img = e.currentTarget
              setDimensions({ width: img.naturalWidth, height: img.naturalHeight })
            }}
            className="max-h-88 max-w-full rounded-md object-contain shadow-xs transition-transform duration-150 hover:scale-[1.01]"
          />
        </button>
      </div>

      {preview.notice ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">{preview.notice}</p>
      ) : null}

      {/* In-app Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[92vw] overflow-hidden p-4 sm:max-w-5xl">
          <DialogHeader className="mb-2">
            <DialogTitle className="flex min-w-0 items-baseline font-mono text-xs font-normal text-muted-foreground">
              {titleText ? (
                <Tooltip>
                  <TooltipTrigger render={<span />} className="cursor-default truncate">
                    {titleText}
                  </TooltipTrigger>
                  <TooltipContent className="max-w-lg font-mono text-xs break-all">
                    {titleText}
                  </TooltipContent>
                </Tooltip>
              ) : (
                'Image Preview'
              )}
              {dimensions ? (
                <span className="ml-2 shrink-0 font-mono text-[11px] whitespace-nowrap text-muted-foreground/60 tabular-nums">
                  ({dimensions.width} × {dimensions.height})
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>

          {/* Viewport container: overflow-hidden ensures no scrollbars under any scale/dimensions */}
          <div className="relative flex max-h-[78vh] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/20 p-2 select-none">
            <img
              src={preview.src}
              alt={titleText || 'Full preview'}
              className="block max-h-[74vh] max-w-[88vw] rounded object-contain shadow-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
