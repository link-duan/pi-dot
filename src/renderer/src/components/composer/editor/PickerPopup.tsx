import type { ReactNode, Ref } from 'react'
import { Popover } from '@base-ui/react/popover'
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@/components/ui/scroll-area'

/** Keep clear of the title bar overlay: ChatPage's `h-11` strip with the traffic lights. */
const TITLE_BAR = 44

/**
 * The frame of the `/` and `@` pickers: a scrolling list above `anchor`, flipped below it and
 * shortened when there is no room. Focus stays in the editor, which owns the picker's keys.
 */
export function PickerPopup({
  anchor,
  listRef,
  children,
}: {
  anchor: Element | null
  listRef: Ref<HTMLDivElement>
  children: ReactNode
}) {
  return (
    <Popover.Root open>
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={{ top: TITLE_BAR + 8, right: 8, bottom: 8, left: 8 }}
          className="isolate z-50 data-anchor-hidden:hidden"
        >
          <Popover.Popup
            initialFocus={false}
            finalFocus={false}
            className="w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-xl border border-border bg-popover py-1.5 pl-1.5 text-popover-foreground shadow-md outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0"
            onMouseDown={(event) => event.preventDefault()}
          >
            <ScrollArea>
              <ScrollAreaViewport
                ref={listRef}
                className="h-auto! max-h-[min(16rem,calc(var(--available-height)-0.875rem))] scroll-fade overscroll-contain pr-2.5"
              >
                {children}
              </ScrollAreaViewport>
              <ScrollAreaScrollbar className="my-0.5" />
            </ScrollArea>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
