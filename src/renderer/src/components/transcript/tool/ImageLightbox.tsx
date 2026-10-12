import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ChevronLeft, ChevronRight, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ToolImageItem } from './images'

// `fitWidth` is the fitted (unscaled) image width, recorded so render can show the zoom percent.
type View = { scale: number; x: number; y: number; fitWidth?: number }
const FIT: View = { scale: 1, x: 0, y: 0 }
const MAX_SCALE = 8

/** Keeps the zoomed image covering the stage: no panning along an axis where it fits. */
function clampView(view: View, img: HTMLImageElement, stage: HTMLElement): View {
  const scale = Math.min(MAX_SCALE, Math.max(1, view.scale))
  if (scale === 1) return FIT
  const maxX = Math.max(0, (img.offsetWidth * scale - stage.clientWidth) / 2)
  const maxY = Math.max(0, (img.offsetHeight * scale - stage.clientHeight) / 2)
  const clamp = (value: number, max: number) => Math.min(max, Math.max(-max, value))
  return { scale, x: clamp(view.x, maxX), y: clamp(view.y, maxY), fitWidth: img.offsetWidth }
}

/** Scales around a point given relative to the stage center, keeping that point fixed. */
function zoomAt(view: View, scale: number, px: number, py: number): View {
  const ratio = scale / view.scale
  return { scale, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio }
}

/** Full-window viewer for a group of images; `index` null means closed. */
export function ImageLightbox({
  images,
  index,
  onIndexChange,
}: {
  images: ToolImageItem[]
  index: number | null
  onIndexChange: (index: number | null) => void
}) {
  const image = index === null ? undefined : images[index]
  const step = (delta: number) => {
    if (index !== null) onIndexChange((index + delta + images.length) % images.length)
  }

  return (
    <Dialog.Root open={Boolean(image)} onOpenChange={(open) => !open && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup
          className="fixed inset-0 z-50 flex flex-col duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          onKeyDown={(event) => {
            if (images.length < 2) return
            if (event.key === 'ArrowLeft') step(-1)
            else if (event.key === 'ArrowRight') step(1)
          }}
        >
          {image && index !== null ? (
            // Keyed so zoom and size reset when switching images.
            <LightboxView
              key={index}
              image={image}
              position={images.length > 1 ? `${index + 1}/${images.length}` : ''}
              onStep={images.length > 1 ? step : undefined}
              onClose={() => onIndexChange(null)}
            />
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function LightboxView({
  image,
  position,
  onStep,
  onClose,
}: {
  image: ToolImageItem
  position: string
  onStep?: (delta: number) => void
  onClose: () => void
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [view, setView] = useState<View>(FIT)
  const [dragging, setDragging] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{
    x: number
    y: number
    view: View
    moved: boolean
    onBackdrop: boolean
  } | null>(null)
  const title = image.path || image.title
  // Only a real file has a name worth showing; tool titles repeat the card header.
  const name = image.path?.split('/').at(-1)
  const zoomed = view.scale > 1
  const percent =
    zoomed && size && view.fitWidth
      ? `${Math.round((view.scale * view.fitWidth * 100) / size.width)}%`
      : ''
  const meta = [size ? `${size.width}×${size.height}` : '', percent, position]
    .filter(Boolean)
    .join(' · ')

  // Pointer position relative to the stage center, where the fitted image is centered.
  const fromCenter = (clientX: number, clientY: number) => {
    const rect = stageRef.current!.getBoundingClientRect()
    return [clientX - rect.left - rect.width / 2, clientY - rect.top - rect.height / 2] as const
  }
  const update = (next: (view: View) => View) => {
    setView((current) => clampView(next(current), imgRef.current!, stageRef.current!))
  }

  // React wheel listeners are passive, so preventDefault needs a native listener.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      // Pinch gestures arrive as ctrl+wheel with much smaller deltas.
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002))
      const rect = stage.getBoundingClientRect()
      const px = event.clientX - rect.left - rect.width / 2
      const py = event.clientY - rect.top - rect.height / 2
      setView((current) => {
        const scale = Math.min(MAX_SCALE, Math.max(1, current.scale * factor))
        return clampView(zoomAt(current, scale, px, py), imgRef.current!, stage)
      })
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    // Read the target here: once the pointer is captured, pointerup targets the stage itself.
    const onBackdrop = !(event.target as Element).closest('img, button')
    drag.current = { x: event.clientX, y: event.clientY, view, moved: false, onBackdrop }
    if (zoomed) {
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragging(true)
    }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.hypot(dx, dy) > 3) start.moved = true
    if (zoomed) update(() => ({ ...start.view, x: start.view.x + dx, y: start.view.y + dy }))
  }
  const onPointerUp = () => {
    const start = drag.current
    drag.current = null
    setDragging(false)
    // A plain click on the backdrop closes; the end of a drag does not.
    if (start?.onBackdrop && !start.moved) onClose()
  }
  const onDoubleClick = (event: MouseEvent) => {
    const img = imgRef.current
    if (!img || !size) return
    const actual = size.width / img.offsetWidth
    if (actual <= 1) return
    const [px, py] = fromCenter(event.clientX, event.clientY)
    update((current) => (current.scale > 1 ? FIT : zoomAt(current, actual, px, py)))
  }

  return (
    <>
      {/* Draggable like the window title bar; the left side stays clear for the macOS traffic lights. */}
      <div className="app-drag flex h-12 shrink-0 items-center justify-end pr-2">
        <div className="app-no-drag">
          <Dialog.Close
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              />
            }
          >
            <XIcon />
          </Dialog.Close>
        </div>
      </div>
      <div
        ref={stageRef}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden select-none',
          zoomed && (dragging ? 'cursor-grabbing' : 'cursor-grab'),
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null
          setDragging(false)
        }}
        onDoubleClick={onDoubleClick}
      >
        <div className="flex h-full items-center justify-center px-16">
          <img
            ref={imgRef}
            src={image.src}
            alt={title || 'Image preview'}
            draggable={false}
            onLoad={(event) =>
              setSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            className={cn(
              'block max-h-full max-w-full rounded-md object-contain shadow-lg will-change-transform',
              !zoomed && 'cursor-zoom-in',
            )}
          />
        </div>
        {onStep ? (
          <>
            <NavButton side="left" onClick={() => onStep(-1)} />
            <NavButton side="right" onClick={() => onStep(1)} />
          </>
        ) : null}
      </div>
      <div className="flex h-12 shrink-0 items-center justify-center gap-2 px-16 text-xs text-muted-foreground">
        <Dialog.Title className="min-w-0 truncate font-normal text-foreground" title={title}>
          {name ?? <span className="sr-only">Image</span>}
        </Dialog.Title>
        {meta ? (
          <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[11px] leading-none tabular-nums">
            {meta}
          </span>
        ) : null}
      </div>
    </>
  )
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={side === 'left' ? 'Previous image' : 'Next image'}
      className={cn(
        'fixed top-1/2 -translate-y-1/2 rounded-full bg-background/80 text-muted-foreground shadow-sm hover:text-foreground',
        side === 'left' ? 'left-4' : 'right-4',
      )}
      onClick={onClick}
    >
      <Icon />
    </Button>
  )
}
