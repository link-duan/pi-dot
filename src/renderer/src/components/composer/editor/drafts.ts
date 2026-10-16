import { createEmptyHistoryState, registerHistory, type HistoryState } from '@lexical/history'
import {
  $createParagraphNode,
  $getRoot,
  SKIP_DOM_SELECTION_TAG,
  type EditorState,
  type LexicalEditor,
} from 'lexical'
import { serializeEditorState } from './serialize'

type SessionDoc = {
  draft: EditorState | null
  history: HistoryState
}

const sessions = new Map<string, SessionDoc>()
let idle: SessionDoc = blankDoc()

function blankDoc(): SessionDoc {
  return { draft: null, history: createEmptyHistoryState() }
}

function docFor(sessionFile: string | null): SessionDoc {
  if (!sessionFile) return idle
  const existing = sessions.get(sessionFile)
  if (existing) return existing
  const created = blankDoc()
  sessions.set(sessionFile, created)
  return created
}

export function readDraft(sessionFile: string): EditorState | undefined {
  return sessions.get(sessionFile)?.draft ?? undefined
}

export function draftText(sessionFile: string | null): string {
  const saved = sessionFile ? sessions.get(sessionFile)?.draft : null
  return saved ? serializeEditorState(saved) : ''
}

export function rememberDraft(sessionFile: string | null, state: EditorState): void {
  if (!sessionFile) return
  if (!serializeEditorState(state)) {
    const doc = sessions.get(sessionFile)
    if (doc) doc.draft = null
    return
  }
  docFor(sessionFile).draft = state
}

export function clearDrafts(): void {
  sessions.clear()
  idle = blankDoc()
}

function editorFocused(editor: LexicalEditor): boolean {
  const root = editor.getRootElement()
  return root != null && root.contains(root.ownerDocument.activeElement)
}

function showSessionDraft(editor: LexicalEditor, sessionFile: string | null): void {
  const focused = editorFocused(editor)
  const saved = sessionFile ? sessions.get(sessionFile)?.draft : undefined
  const tag = focused ? undefined : SKIP_DOM_SELECTION_TAG
  if (saved) {
    editor.setEditorState(saved, tag ? { tag } : undefined)
    return
  }
  editor.update(
    () => {
      const root = $getRoot()
      root.clear()
      const paragraph = $createParagraphNode()
      root.append(paragraph)
      if (focused) paragraph.select()
    },
    { discrete: true, ...(tag ? { tag } : {}) },
  )
}

/** Save the editor onto `from`, then show `to`. `from` null does not overwrite a stored draft. */
export function moveDraft(editor: LexicalEditor, from: string | null, to: string | null): void {
  rememberDraft(from, editor.getEditorState())
  showSessionDraft(editor, to)
}

export function historyFor(sessionFile: string | null): HistoryState {
  return docFor(sessionFile).history
}

/** Save `from`, show `to`, and return the undo-stack unsubscribe for this editor. */
export function activateSession(
  editor: LexicalEditor,
  from: string | null,
  to: string | null,
): () => void {
  moveDraft(editor, from, to)
  return registerHistory(editor, historyFor(to), 1000)
}
