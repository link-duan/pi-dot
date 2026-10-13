import type { ReactNode } from 'react'

/** What the user sent, on the right: a message, or an extension command; `footer` goes below. */
export function UserBubble({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="group/user mt-6 mb-2 flex justify-end group-first/turn:mt-2 first:mt-2">
      <div className="flex max-w-[min(32rem,80%)] min-w-0 flex-col items-end">
        <div className="w-fit max-w-full rounded-xl bg-foreground/4 px-3 py-2 leading-relaxed break-words whitespace-pre-wrap text-foreground select-text dark:bg-foreground/12">
          {children}
        </div>
        {footer}
      </div>
    </div>
  )
}
