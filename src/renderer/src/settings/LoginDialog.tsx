import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AuthNotify, AuthPrompt, LoginEvent, ProviderAuthMethod } from '@shared/settings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export function LoginDialog({
  providerId,
  providerName,
  methods,
  onClose,
}: {
  providerId: string
  providerName: string
  methods: ProviderAuthMethod[]
  onClose: (ok: boolean) => void
}) {
  const [method, setMethod] = useState<ProviderAuthMethod | null>(null)
  const [notices, setNotices] = useState<AuthNotify[]>([])
  const [prompt, setPrompt] = useState<{ id: string; prompt: AuthPrompt } | null>(null)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return window.pi.onLoginEvent((event: LoginEvent) => {
      if (event.kind === 'notify') setNotices((items) => [...items, event.event])
      if (event.kind === 'prompt') {
        setPrompt({ id: event.id, prompt: event.prompt })
        setAnswer('')
      }
      if (event.kind === 'done') {
        setBusy(false)
        if (event.ok) onClose(true)
        else setError(event.message ?? 'Login failed')
      }
    })
  }, [onClose])

  function start(next: ProviderAuthMethod): void {
    setMethod(next)
    setBusy(true)
    setError(null)
    void window.pi.login(providerId, next.type).catch((reason: unknown) => {
      setBusy(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          void window.pi.loginCancel()
          onClose(false)
        }
      }}
    >
      <DialogContent className="border-border/60 bg-background/95 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Login to {providerName}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {method ? method.name : 'Choose an authentication method to connect this provider.'}
          </DialogDescription>
        </DialogHeader>

        {!method ? (
          <div className="flex flex-col gap-2 py-2">
            {methods.map((item) => (
              <Button
                key={item.type}
                type="button"
                variant="outline"
                className="h-auto w-full justify-between rounded-xl border-border/60 bg-card/40 p-3.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40"
                onClick={() => start(item)}
              >
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {item.loginLabel ?? item.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{item.type}</div>
                </div>
                <span className="text-xs text-muted-foreground">Connect →</span>
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto py-2 text-sm">
            {notices.map((item, index) => (
              <Notice key={`${item.type}-${index}`} event={item} />
            ))}
            {prompt ? (
              <PromptForm
                prompt={prompt.prompt}
                value={answer}
                onChange={setAnswer}
                onSubmit={(value) => {
                  void window.pi.loginRespond(prompt.id, value)
                  setPrompt(null)
                  setAnswer('')
                }}
              />
            ) : busy ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-foreground" />
                <span>Waiting for authentication response…</span>
              </div>
            ) : null}
            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                {error}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="border-t border-border/40 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void window.pi.loginCancel()
              onClose(false)
            }}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Notice({ event }: { event: AuthNotify }) {
  const [copied, setCopied] = useState(false)

  if (event.type === 'auth_url') {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 text-xs">
        <p className="font-medium text-foreground">Opened browser to sign in.</p>
        {event.instructions ? (
          <p className="mt-1 text-muted-foreground">{event.instructions}</p>
        ) : null}
      </div>
    )
  }
  if (event.type === 'device_code') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 p-3.5 text-xs">
        <p className="text-muted-foreground">Enter code in browser to authenticate:</p>
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
          <span className="text-base font-bold tracking-widest text-foreground">
            {event.userCode}
          </span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard.writeText(event.userCode)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
    )
  }
  if (event.type === 'info') {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 text-xs">
        <p className="text-foreground">{event.message}</p>
        {event.links?.map((link) => (
          <Button
            key={link.url}
            type="button"
            variant="link"
            size="xs"
            className="mt-1.5 inline-flex h-auto items-center gap-1 p-0 text-xs text-primary underline underline-offset-2 hover:opacity-80"
            onClick={() => void window.pi.openExternal(link.url)}
          >
            <span>{link.label ?? link.url}</span>
            <ExternalLink className="size-3" />
          </Button>
        ))}
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
      {event.message}
    </div>
  )
}

function PromptForm({
  prompt,
  value,
  onChange,
  onSubmit,
}: {
  prompt: AuthPrompt
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
}) {
  if (prompt.type === 'select') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-foreground">{prompt.message}</p>
        <div className="flex flex-col gap-1.5">
          {prompt.options.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              size="sm"
              className="justify-start text-left"
              onClick={() => onSubmit(option.id)}
            >
              <span>{option.label}</span>
              {option.description ? (
                <span className="text-xs text-muted-foreground">({option.description})</span>
              ) : null}
            </Button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(value)
      }}
    >
      <p className="text-xs font-medium text-foreground">{prompt.message}</p>
      <Input
        type={prompt.type === 'secret' ? 'password' : 'text'}
        placeholder={prompt.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="text-xs"
        autoFocus
      />
      <Button type="submit" size="sm" className="self-end">
        Continue
      </Button>
    </form>
  )
}
