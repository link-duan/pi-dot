import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area'
import { cn } from '@/lib/utils'

function ScrollArea({ className, ...props }: ScrollAreaPrimitive.Root.Props) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative min-h-0 overflow-hidden', className)}
      {...props}
    />
  )
}

function ScrollAreaViewport({ className, ...props }: ScrollAreaPrimitive.Viewport.Props) {
  return (
    <ScrollAreaPrimitive.Viewport
      data-slot="scroll-area-viewport"
      className={cn('size-full overscroll-contain', className)}
      {...props}
    />
  )
}

function ScrollAreaContent({ className, ...props }: ScrollAreaPrimitive.Content.Props) {
  return (
    <ScrollAreaPrimitive.Content
      data-slot="scroll-area-content"
      className={cn('min-w-full', className)}
      {...props}
    />
  )
}

function ScrollAreaScrollbar({
  className,
  children,
  orientation = 'vertical',
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'group/scrollbar z-10 flex p-px',
        orientation === 'vertical' && 'w-2.5 justify-end',
        orientation === 'horizontal' && 'h-2.5 flex-col items-end',
        className,
      )}
      {...props}
    >
      {children ?? <ScrollAreaThumb />}
    </ScrollAreaPrimitive.Scrollbar>
  )
}

function ScrollAreaThumb({ className, ...props }: ScrollAreaPrimitive.Thumb.Props) {
  return (
    <ScrollAreaPrimitive.Thumb
      data-slot="scroll-area-thumb"
      className={cn(
        'rounded-full bg-[color-mix(in_oklch,var(--foreground)_22%,transparent)] transition-[width,height,background-color] duration-150 group-hover/scrollbar:bg-[color-mix(in_oklch,var(--foreground)_40%,transparent)] in-data-[orientation=horizontal]:h-1.5 in-data-[orientation=horizontal]:group-hover/scrollbar:h-2 in-data-[orientation=vertical]:w-1.5 in-data-[orientation=vertical]:group-hover/scrollbar:w-2',
        className,
      )}
      {...props}
    />
  )
}

export { ScrollArea, ScrollAreaContent, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport }
