import { Toaster as Sonner, type ToasterProps } from 'sonner'
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react'

// The app follows the system appearance, as does `theme="system"`.
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-3.5" />,
        info: <InfoIcon className="size-3.5" />,
        warning: <TriangleAlertIcon className="size-3.5" />,
        error: <OctagonXIcon className="size-3.5" />,
        loading: <Loader2Icon className="size-3.5 animate-spin" />,
      }}
      // Our own look, close to the cards above the Composer; titles keep their newlines.
      // Unstyled, sonner no longer hides the content of the toasts stacked behind the front
      // one, so the toast class does.
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-(--width) items-start gap-2 overflow-hidden rounded-xl border border-border bg-popover/95 px-3 py-2.5 text-popover-foreground shadow-lg shadow-black/5 backdrop-blur-md *:transition-opacity data-[expanded=false]:data-[front=false]:*:opacity-0 dark:shadow-black/30',
          icon: 'mt-0.5 flex size-4 shrink-0 items-center justify-center text-muted-foreground',
          warning: '[&_[data-icon]]:text-plan',
          error: '[&_[data-icon]]:text-destructive',
          content: 'min-w-0 flex-1',
          title: 'text-[13px] leading-5 break-words whitespace-pre-wrap',
          description: 'text-xs text-muted-foreground',
          // `!`: sonner's dark theme styles the close button with attribute selectors.
          closeButton:
            'order-last -mr-1 flex size-5 shrink-0 items-center justify-center rounded-md border-0! bg-transparent! text-muted-foreground! hover:bg-muted! hover:text-foreground!',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
