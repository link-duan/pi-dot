import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ImageLightbox } from './ImageLightbox'
import type { ToolImageItem } from './images'

type Size = { width: number; height: number }

/** Tool result images laid out side by side, with one quiet caption line underneath. */
export function ToolImages({ images, notice }: { images: ToolImageItem[]; notice?: string }) {
  const [size, setSize] = useState<Size | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const single = images.length === 1
  const first = images[0]
  const caption = [
    first?.path || first?.title,
    single && size ? `${size.width}×${size.height}` : '',
    // Read hints arrive as bracketed lines, e.g. "[Image resized from 512x512 to 64x64.]".
    notice
      ?.split('\n')
      .map((line) => line.trim().replace(/^\[(.*)\]$/, '$1'))
      .join(' '),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div>
      <div className="flex flex-wrap items-start gap-2">
        {images.map((image, index) => (
          <ToolImage
            key={image.src}
            preview={image}
            compact={!single}
            onOpen={() => setOpenIndex(index)}
            onSize={index === 0 ? setSize : undefined}
          />
        ))}
      </div>
      {caption ? (
        <p className="mt-1.5 truncate text-xs text-muted-foreground" title={caption}>
          {caption}
        </p>
      ) : null}
      <ImageLightbox images={images} index={openIndex} onIndexChange={setOpenIndex} />
    </div>
  )
}

function ToolImage({
  preview,
  compact,
  onOpen,
  onSize,
}: {
  preview: ToolImageItem
  compact: boolean
  onOpen: () => void
  onSize?: (size: Size) => void
}) {
  const titleText = preview.path || preview.title

  return (
    <div className="group/img relative w-fit max-w-full overflow-hidden rounded-lg border border-border bg-muted/30">
      <button
        type="button"
        aria-label={`Preview ${titleText || 'image'}`}
        onClick={onOpen}
        className="block cursor-zoom-in focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      >
        <img
          src={preview.src}
          alt={titleText || 'Image preview'}
          loading="lazy"
          decoding="async"
          onLoad={(event) =>
            onSize?.({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          className={cn('block max-w-full object-contain', compact ? 'max-h-40' : 'max-h-72')}
        />
      </button>
      <div className="absolute top-1 right-1 rounded-md bg-background/80 opacity-0 shadow-xs backdrop-blur-sm transition-opacity group-hover/img:opacity-100 focus-within:opacity-100">
        <CopyImageButton image={preview} className="size-6 [&_svg]:size-3.5" />
      </div>
    </div>
  )
}

/** Copies the image itself, falling back to its path when the clipboard rejects the image. */
function CopyImageButton({ image, className }: { image: ToolImageItem; className?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      const blob = await (await fetch(image.src)).blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    } catch (error) {
      console.warn('Failed to copy image preview', error)
      if (!image.path) return
      await navigator.clipboard.writeText(image.path)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Copy image"
      title={copied ? 'Copied' : 'Copy image'}
      className={cn('text-muted-foreground hover:text-foreground', className)}
      onClick={() => void copy()}
    >
      {copied ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Copy />}
    </Button>
  )
}
