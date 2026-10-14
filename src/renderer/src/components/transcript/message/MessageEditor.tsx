import { useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ComposerCard, PlanBadge } from '@/components/Composer'
import { promptEditorConfig } from '@/components/composer/PromptEditor'
import { $setComposerText } from '@/components/composer/set-text'
import { ModelSelect } from '@/components/ModelSelect'
import { Button } from '@/components/ui/button'
import { useChat, useSession } from '@/session/store'

/**
 * The user message sent at `timestamp`, edited in place in the Plan Mode it was sent in. Sending
 * rewinds to before the message and sends the edit instead.
 */
export function MessageEditor({
  timestamp,
  text,
  planMode: sentInPlanMode,
}: {
  timestamp: number
  text: string
  planMode: boolean
}) {
  const [config] = useState(() => ({
    ...promptEditorConfig('pi-edit-message'),
    editorState: () => $setComposerText(text),
  }))
  const [draft, setDraft] = useState(text)
  const [planMode, setPlanMode] = useState(sentInPlanMode)
  const editMessage = useSession((state) => state.editMessage)
  const closeEdit = useSession((state) => state.closeEdit)
  // An edit rewinds the session, so it waits for the run to end.
  const canRun = useSession((state) => state.connection === 'ready' && state.models.length > 0)
  const isStreaming = useChat((state) => state.isStreaming)
  const ready = canRun && !isStreaming

  return (
    <LexicalComposer initialConfig={config}>
      <HistoryPlugin />
      <ComposerCard
        scope="message"
        placeholder={planMode ? 'Describe what to plan...' : 'Message...'}
        planMode={planMode}
        onPlanModeChange={setPlanMode}
        onChange={setDraft}
        onCommand={(name) => {
          if (name === 'plan') setPlanMode(true)
        }}
        onSubmit={(next) => {
          if (ready) void editMessage(timestamp, next, planMode)
        }}
        onEscape={closeEdit}
        autoFocus
      >
        <div className="flex items-center justify-between gap-2 px-0.5 text-xs">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {planMode ? <PlanBadge onExit={() => setPlanMode(false)} /> : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <ModelSelect />
            <Button type="button" variant="ghost" size="xs" onClick={closeEdit}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="icon-sm"
              className="-mr-1 rounded-[calc(var(--radius-2xl)-5px)] transition-opacity"
              disabled={!ready || !draft.trim()}
              aria-label="Send"
              title={isStreaming ? 'Available when the run ends' : 'Send'}
            >
              <ArrowUp className="size-3.5" />
            </Button>
          </div>
        </div>
      </ComposerCard>
    </LexicalComposer>
  )
}
