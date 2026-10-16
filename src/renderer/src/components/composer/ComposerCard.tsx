import { useCallback, useEffect, type ComponentProps, type ReactNode } from 'react'
import {
  $getRoot,
  COMMAND_PRIORITY_NORMAL,
  INSERT_LINE_BREAK_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { cn } from '@/lib/utils'
import { PromptEditorField } from '@/components/composer/editor/PromptEditorField'
import { serializeEditorState } from './editor/serialize'

/**
 * The prompt box: the editor, its keys and its Plan Mode border, inside a `LexicalComposer`.
 * Submitting hands over the trimmed text; what goes below the editor is `children`.
 */
export function ComposerCard({
  planMode,
  onPlanModeChange,
  onSubmit,
  onFollowUp,
  onEscape,
  autoFocus,
  children,
  ...field
}: Pick<
  ComponentProps<typeof PromptEditorField>,
  'id' | 'scope' | 'placeholder' | 'onChange' | 'onCommand'
> & {
  planMode: boolean
  onPlanModeChange: (on: boolean) => void
  onSubmit: (text: string) => void
  /** Alt+Enter, e.g. queueing a follow-up while the run streams. */
  onFollowUp?: (text: string) => void
  onEscape?: () => void
  /** Focuses the editor once mounted, with the caret at the end. */
  autoFocus?: boolean
  children: ReactNode
}) {
  const [editor] = useLexicalComposerContext()
  const take = useCallback(
    (handler: (text: string) => void) => {
      const text = serializeEditorState(editor.getEditorState()).trim()
      if (text) handler(text)
    },
    [editor],
  )

  useEffect(() => {
    if (!autoFocus) return
    // An initial editor state drops its selection, so the caret goes to the end here.
    editor.update(() => $getRoot().selectEnd())
    editor.focus()
  }, [autoFocus, editor])

  return (
    <form
      className={cn(
        'pointer-events-auto relative mx-auto max-w-3xl rounded-2xl border bg-card/90 px-1.5 pt-1 pb-1 backdrop-blur-md dark:bg-card/95',
        planMode ? 'border-plan/50' : 'border-border',
      )}
      onSubmit={(event) => {
        event.preventDefault()
        take(onSubmit)
      }}
      onKeyDown={(event) => {
        if (!onEscape || event.key !== 'Escape' || event.defaultPrevented) return
        event.preventDefault()
        onEscape()
      }}
    >
      <PromptEditorField
        {...field}
        className="composer-editor block max-h-[calc(8.5lh+0.5rem)] min-h-[calc(1lh+0.75rem)] w-full scroll-fade overflow-y-auto px-1.5 py-1.5 leading-relaxed text-foreground outline-none"
      />
      <ComposerKeyPlugin
        onSubmit={() => take(onSubmit)}
        onFollowUp={onFollowUp ? () => take(onFollowUp) : undefined}
        onTogglePlanMode={() => onPlanModeChange(!planMode)}
      />
      {children}
    </form>
  )
}

function ComposerKeyPlugin({
  onSubmit,
  onFollowUp,
  onTogglePlanMode,
}: {
  onSubmit: () => void
  onFollowUp?: () => void
  onTogglePlanMode: () => void
}) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        if (!event?.shiftKey) return false
        event.preventDefault()
        onTogglePlanMode()
        return true
      },
      COMMAND_PRIORITY_NORMAL,
    )
  }, [editor, onTogglePlanMode])

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event?.shiftKey) {
          event.preventDefault()
          editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false)
          return true
        }
        if (event?.altKey) {
          if (!onFollowUp) return false
          event.preventDefault()
          onFollowUp()
          return true
        }
        event?.preventDefault()
        onSubmit()
        return true
      },
      COMMAND_PRIORITY_NORMAL,
    )
  }, [editor, onFollowUp, onSubmit])

  return null
}
