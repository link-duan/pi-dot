import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check, Puzzle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { UiRequest, UiResponse } from '@shared/protocol'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { pendingUiRequest } from '@/session/state'
import { useSession } from '@/session/store'
import { BUTTON_RADIUS, CARD, ROW } from './card'
import { RowNumber } from './RowNumber'

/** Above the Composer while an extension waits on a select, confirm, input or editor dialog. */
export function ExtensionDialogCard() {
  const pending = useSession(useShallow(pendingUiRequest))
  if (!pending) return null
  return <DialogForm key={pending.request.id} request={pending.request} count={pending.count} />
}

function DialogForm({ request, count }: { request: UiRequest; count: number }) {
  const respondUi = useSession((state) => state.respondUi)
  const [submitting, setSubmitting] = useState(false)
  const [text, setText] = useState(() =>
    request.method === 'editor' ? (request.prefill ?? '') : '',
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  const reply = (response: UiResponse) => {
    if (submitting) return
    setSubmitting(true)
    // The card goes when main dismisses the request; on failure the store reports the error.
    respondUi(request.id, response).catch(() => setSubmitting(false))
  }
  const cancel = () => reply({ kind: 'cancel' })

  useEffect(() => {
    // Take focus unless the user is typing something.
    const active = document.activeElement as HTMLElement | null
    if (active === document.body || (active?.isContentEditable && !active.textContent?.trim())) {
      ;(fieldRef.current ?? rootRef.current)?.focus()
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancel()
      return
    }
    if (request.method === 'confirm' && event.key === 'Enter' && event.target === rootRef.current) {
      event.preventDefault()
      reply({ kind: 'confirm', confirmed: true })
      return
    }
    if (request.method === 'select') {
      const digit = Number(event.key)
      const rows = [...rootRef.current!.querySelectorAll<HTMLElement>('[data-row]')]
      const at = rows.indexOf(document.activeElement as HTMLElement)
      if (Number.isInteger(digit) && digit >= 1 && digit <= request.options.length) {
        reply({ kind: 'value', value: request.options[digit - 1]! })
      } else if (event.key === 'ArrowDown') rows[(at + 1) % rows.length]?.focus()
      else if (event.key === 'ArrowUp') rows[at <= 0 ? rows.length - 1 : at - 1]?.focus()
      else return
      event.preventDefault()
    }
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-label={request.title}
      onKeyDown={onKeyDown}
      className={CARD}
    >
      <div className="flex items-center gap-2 px-2 pt-1 pb-1.5">
        <Puzzle className="size-3.5 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{request.title}</p>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
          {count > 1 ? <span>1 / {count}</span> : null}
          {count > 1 && request.expiresAt ? <span>·</span> : null}
          {request.expiresAt ? <Countdown expiresAt={request.expiresAt} /> : null}
        </span>
      </div>

      {request.method === 'select' ? (
        <div
          role="listbox"
          aria-label={request.title}
          className="max-h-64 scroll-fade overflow-y-auto"
        >
          {request.options.map((option, index) => (
            <button
              key={`${option}:${index}`}
              type="button"
              data-row
              role="option"
              aria-selected={false}
              disabled={submitting}
              onClick={() => reply({ kind: 'value', value: option })}
              className={cn(ROW, 'group/row focus-visible:bg-muted/50')}
            >
              <RowNumber value={index + 1} />
              <span className="min-w-0 flex-1 text-foreground">{option}</span>
              <Check className="invisible size-3.5 shrink-0 self-center group-focus-visible/row:visible" />
            </button>
          ))}
        </div>
      ) : null}

      {request.method === 'confirm' && request.message ? (
        <p className="line-clamp-6 px-2 pb-1 text-xs whitespace-pre-wrap text-muted-foreground">
          {request.message}
        </p>
      ) : null}

      {request.method === 'input' ? (
        <div className="px-1 pb-1">
          <Input
            ref={fieldRef}
            value={text}
            disabled={submitting}
            placeholder={request.placeholder}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
              event.preventDefault()
              reply({ kind: 'value', value: text })
            }}
          />
        </div>
      ) : null}

      {request.method === 'editor' ? (
        <div className="px-1 pb-1">
          <Textarea
            ref={fieldRef}
            value={text}
            disabled={submitting}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !event.metaKey || event.nativeEvent.isComposing) return
              event.preventDefault()
              reply({ kind: 'value', value: text })
            }}
            className="max-h-[calc(12lh+1rem)] min-h-[calc(4lh+1rem)] font-mono text-xs md:text-xs"
          />
        </div>
      ) : null}

      <div className="mt-1 flex justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('text-muted-foreground', BUTTON_RADIUS)}
          disabled={submitting}
          onClick={cancel}
        >
          Cancel
        </Button>
        {request.method === 'confirm' ? (
          <Button
            type="button"
            size="sm"
            className={BUTTON_RADIUS}
            disabled={submitting}
            onClick={() => reply({ kind: 'confirm', confirmed: true })}
          >
            Confirm
          </Button>
        ) : null}
        {request.method === 'input' || request.method === 'editor' ? (
          <Button
            type="button"
            size="sm"
            className={BUTTON_RADIUS}
            disabled={submitting}
            onClick={() => reply({ kind: 'value', value: text })}
          >
            {request.method === 'input' ? 'Submit' : 'Save'}
            <Kbd className="bg-transparent px-0 text-primary-foreground/60">
              {request.method === 'input' ? '⏎' : '⌘⏎'}
            </Kbd>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function Countdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  return <span className={cn(seconds <= 5 && 'text-destructive')}>{seconds}s</span>
}
