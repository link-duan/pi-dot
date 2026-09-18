import { ArrowUp, Folder, Square } from 'lucide-react'
import { useRef, useState } from 'react'
import { useChat } from '@/chat/store'
import { Button } from '@/components/ui/button'
import { folderName } from '@/lib/path'
import { useSession } from '@/session/store'
import { ModelSelect } from './ModelSelect'

export function Composer() {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composingRef = useRef(false)
  const cwd = useSession((state) => state.cwd)
  const connection = useSession((state) => state.connection)
  const send = useSession((state) => state.send)
  const abort = useSession((state) => state.abort)
  const openFolder = useSession((state) => state.openFolder)
  const isStreaming = useChat((state) => state.isStreaming)

  const canSend = connection === 'ready' && text.trim().length > 0 && !isStreaming

  function submit() {
    const next = text.trim()
    if (!next || isStreaming || connection !== 'ready') return
    setText('')
    void send(next)
  }

  return (
    <form
      className="pointer-events-none relative z-10 -mt-6 shrink-0 px-4 pt-1 pb-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-border/80 bg-card/90 px-1.5 pt-1 pb-1 shadow-xl shadow-black/5 backdrop-blur-md dark:bg-[#121316]/95 dark:shadow-black/50">
        <label className="sr-only" htmlFor="prompt-input">
          Prompt
        </label>
        <textarea
          ref={textareaRef}
          id="prompt-input"
          value={text}
          rows={1}
          placeholder="Message..."
          className="block field-sizing-content max-h-[calc(8.5lh+0.5rem)] w-full scroll-fade resize-none overflow-y-auto border-0 bg-transparent px-2.5 py-1.5 leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          onChange={(event) => setText(event.target.value)}
          onCompositionStart={() => {
            composingRef.current = true
          }}
          onCompositionEnd={() => {
            // IME confirmation Enter can arrive after compositionend.
            queueMicrotask(() => {
              composingRef.current = false
            })
          }}
          onKeyDown={(event) => {
            if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) {
              return
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
        />

        <div className="flex items-center justify-between px-0.5 text-xs">
          <div className="flex items-center gap-2">
            {cwd ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => void openFolder()}
                className="max-w-56 text-xs text-muted-foreground"
                title={`Current folder: ${cwd} (click to change)`}
              >
                <Folder className="size-3 shrink-0" />
                <span className="truncate">{folderName(cwd)}</span>
              </Button>
            ) : null}
          </div>

          {/* Right: Model Select & Submit */}
          <div className="flex items-center gap-1.5">
            <ModelSelect />

            {isStreaming ? (
              <Button
                type="button"
                size="icon-sm"
                className="rounded-full shadow-xs"
                aria-label="Stop"
                onClick={() => void abort()}
              >
                <Square className="size-2.5 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-sm"
                className="rounded-full shadow-xs transition-opacity"
                disabled={!canSend}
                aria-label="Send"
              >
                <ArrowUp className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
