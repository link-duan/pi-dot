import { appendExtensionLine, type ChatState } from '@/chat/state'
import { extensionCommand } from '@/lib/slash-query'
import { formatApproval, formatPlanFeedback, reanchor, type PlanComment } from '@/lib/plan-feedback'
import { parsePlan } from '@shared/plan-file'
import type {
  AgentMessage,
  AskReply,
  MessageRef,
  ModelSelection,
  SessionListItem,
  SessionSnapshot,
  ThinkingLevel,
  UiResponse,
} from '@shared/protocol'
import { SerialQueue } from '@shared/queue'
import { create } from 'zustand'
import {
  activeChat,
  applySnapshot,
  createWindowState,
  parkActive,
  noPlanReview,
  patchChat,
  resetFolder,
  reviewComments,
  type WindowState,
} from './state'

interface SessionStore extends WindowState {
  openFolder: () => Promise<void>
  openCwd: (cwd: string) => Promise<void>
  leave: () => Promise<void>
  send: (text: string) => Promise<void>
  steer: (text: string) => Promise<void>
  /** Replies to the active session's `ask_user` call `toolCallId`. */
  answerQuestion: (toolCallId: string, reply: AskReply) => Promise<void>
  respondUi: (id: string, response: UiResponse) => Promise<void>
  /** Asks again whether to trust the folder, reloading it if the answer changed. */
  retrust: () => Promise<void>
  /** Rewinds to before the user message sent at `timestamp` and puts it in the Composer. */
  editMessage: (timestamp: number) => Promise<void>
  /** Leaves an edit, back to the branch it rewound from. */
  cancelEdit: () => Promise<void>
  /** Starts a new session before a user message (filling the Composer with it), or through a reply. */
  forkMessage: (message: MessageRef) => Promise<boolean>
  /** Rewinds to a user message, or through a reply's turn; resolves to its undo, if it worked. */
  rewindMessage: (message: MessageRef) => Promise<(() => Promise<void>) | null>
  fillComposer: (text: string) => void
  removeSteering: (index: number) => Promise<void>
  followUp: (text: string) => Promise<void>
  setFollowUpQueue: (messages: string[]) => Promise<void>
  editFollowUp: (index: number, newText: string) => Promise<void>
  deleteFollowUp: (index: number) => Promise<void>
  moveFollowUp: (fromIndex: number, toIndex: number) => Promise<void>
  promoteFollowUpToSteer: (index: number) => Promise<void>
  clearQueue: () => Promise<void>
  clearSteeringQueue: () => Promise<void>
  abort: () => Promise<void>
  compact: () => Promise<void>
  setModel: (provider: string, modelId: string) => Promise<void>
  setThinkingLevel: (level: ThinkingLevel) => Promise<void>
  listSessions: () => Promise<SessionListItem[]>
  switchSession: (sessionPath: string) => Promise<void>
  newSession: () => Promise<void>
  requestComposerFocus: () => void
  setPlanMode: (on: boolean) => void
  /** Leaves Plan Mode and asks the agent to implement the approved Plan File. */
  approvePlan: () => Promise<void>
  /** Re-reads the Plan File while the Plan Mode toggle is on; `open` shows it if it has content. */
  refreshPlan: (open?: boolean) => Promise<void>
  setPlanDraft: (draft: PlanComment | null) => void
  /** Saves the draft as a comment. */
  commitPlanDraft: () => void
  removePlanComment: (id: string) => void
  /** Sends the inline comments and `note` as one message, then clears them. */
  sendPlanFeedback: (note: string) => Promise<void>
  openPlanViewer: () => void
  closePlanViewer: () => void
}

function selectionPatch(selection: ModelSelection) {
  return {
    model: selection.model,
    thinkingLevel: selection.thinkingLevel,
    thinkingLevels: selection.thinkingLevels,
  }
}

export function applyLiveSnapshot(snapshot: SessionSnapshot, chat?: ChatState) {
  useSession.setState((state) => applySnapshot(state, snapshot, chat))
}

const queueOperations = new Map<string, SerialQueue>()

function enqueueQueueOperation(file: string, operation: () => Promise<void>): Promise<void> {
  const queue = queueOperations.get(file) ?? new SerialQueue()
  queueOperations.set(file, queue)
  return queue.enqueue(operation)
}

function sameQueue(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index])
}

export const useSession = create<SessionStore>((set, get) => ({
  ...createWindowState(),

  openFolder: async () => {
    const cwd = await window.pi.chooseFolder()
    if (cwd) await get().openCwd(cwd)
  },

  openCwd: async (cwd: string) => {
    const previous = { connection: get().connection, error: get().error }
    set({ connection: 'connecting', error: null })
    try {
      const result = await window.pi.start(cwd)
      if (result.kind !== 'started') set(previous)
      else set((state) => applySnapshot({ ...state, chats: {} }, result.snapshot))
    } catch (error) {
      set({
        cwd,
        connection: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  leave: async () => {
    try {
      const result = await window.pi.stop()
      if (result.cancelled) return
    } catch (error) {
      console.error('Failed to stop session', error)
    }
    set((state) => resetFolder(state))
  },

  send: async (text: string) => {
    const file = get().sessionFile
    if (!file) return
    set({ editing: null })
    const planMode = get().chats[file]?.planMode ?? false
    // An extension command runs in main and adds no user message of its own, so the Transcript
    // shows it as a line, above what the extension says. It may wait on its own dialogs, so the
    // Composer does not wait for it.
    if (extensionCommand(text, get().commands)) {
      set((state) => {
        const chat = activeChat(state)
        const line = { kind: 'command' as const, at: chat.messages.length, text }
        return patchChat(state, file, {
          extensionLines: appendExtensionLine(chat.extensionLines, line),
        })
      })
      void window.pi.prompt(text, file, planMode).catch((error: unknown) => {
        set({ error: error instanceof Error ? error.message : String(error) })
      })
      return
    }
    await submitPrompt(file, text, () => window.pi.prompt(text, file, planMode))
  },

  answerQuestion: async (toolCallId: string, reply: AskReply) => {
    const file = get().sessionFile
    if (!file) return
    try {
      await window.pi.answerQuestion(file, toolCallId, reply)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  },

  respondUi: async (id: string, response: UiResponse) => {
    const file = get().sessionFile
    if (!file) return
    try {
      await window.pi.respondUi(file, id, response)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  },

  retrust: async () => {
    try {
      const result = await window.pi.retrust()
      if (result.kind === 'started') {
        set((state) => applySnapshot({ ...state, chats: {} }, result.snapshot))
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  editMessage: async (timestamp: number) => {
    const file = get().sessionFile
    if (!file) return
    try {
      const { snapshot, text, leafId } = await window.pi.editMessage(file, timestamp)
      set((state) => ({
        ...applySnapshot(state, snapshot),
        editing: { sessionFile: file, leafId },
      }))
      get().fillComposer(text)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  cancelEdit: async () => {
    const editing = get().editing
    if (!editing || editing.sessionFile !== get().sessionFile) return
    set({ editing: null })
    if (!editing.leafId) return
    try {
      const snapshot = await window.pi.cancelEdit(editing.sessionFile, editing.leafId)
      set((state) => applySnapshot(state, snapshot))
      get().fillComposer('')
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  forkMessage: async (message: MessageRef) => {
    const file = get().sessionFile
    if (!file) return false
    try {
      let text = ''
      await activateSession(async () => {
        const result = await window.pi.forkMessage(file, message)
        text = result.text
        return result.snapshot
      })
      get().fillComposer(text)
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      return false
    }
  },

  rewindMessage: async (message: MessageRef) => {
    const file = get().sessionFile
    if (!file) return null
    try {
      const { snapshot, leafId } = await window.pi.rewindMessage(file, message)
      set((state) => applySnapshot(state, snapshot))
      if (!leafId) return null
      return async () => {
        try {
          const snapshot = await window.pi.cancelEdit(file, leafId)
          set((state) => applySnapshot(state, snapshot))
        } catch (error) {
          set({ error: error instanceof Error ? error.message : String(error) })
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      return null
    }
  },

  fillComposer: (text: string) => set({ composerFill: { text } }),

  steer: async (text: string) => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]?.steeringQueue ?? []
      try {
        await window.pi.steer(text, file)
        const current = get().chats[file]?.steeringQueue
        if (current && sameQueue(current, before)) {
          set((state) => patchChat(state, file, { steeringQueue: [...before, text] }))
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  removeSteering: async (index: number) => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]?.steeringQueue ?? []
      const next = before.filter((_, itemIndex) => itemIndex !== index)
      if (sameQueue(before, next)) return
      try {
        await window.pi.removeSteering(index, file)
        const current = get().chats[file]?.steeringQueue
        if (current && sameQueue(current, before)) {
          set((state) => patchChat(state, file, { steeringQueue: next }))
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  followUp: async (text: string) => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]?.followUpQueue ?? []
      try {
        await window.pi.followUp(text, file)
        const current = get().chats[file]?.followUpQueue
        if (current && sameQueue(current, before)) {
          set((state) => patchChat(state, file, { followUpQueue: [...before, text] }))
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  setFollowUpQueue: async (messages: string[]) => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]?.followUpQueue ?? []
      try {
        await window.pi.setFollowUpQueue(messages, file)
        const current = get().chats[file]?.followUpQueue
        if (current && sameQueue(current, before)) {
          set((state) => patchChat(state, file, { followUpQueue: [...messages] }))
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  editFollowUp: async (index: number, newText: string) => {
    const file = get().sessionFile
    if (!file) return
    const chat = get().chats[file]
    if (!chat || chat.followUpQueue[index] === undefined) return
    const next = [...chat.followUpQueue]
    next[index] = newText
    await get().setFollowUpQueue(next)
  },

  deleteFollowUp: async (index: number) => {
    const file = get().sessionFile
    if (!file) return
    const chat = get().chats[file]
    if (!chat) return
    const next = chat.followUpQueue.filter((_, i) => i !== index)
    await get().setFollowUpQueue(next)
  },

  moveFollowUp: async (fromIndex: number, toIndex: number) => {
    const file = get().sessionFile
    if (!file) return
    const chat = get().chats[file]
    if (!chat) return
    if (toIndex < 0 || toIndex >= chat.followUpQueue.length) return
    const next = [...chat.followUpQueue]
    const [removed] = next.splice(fromIndex, 1)
    if (removed === undefined) return
    next.splice(toIndex, 0, removed)
    await get().setFollowUpQueue(next)
  },

  promoteFollowUpToSteer: async (index: number) => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]?.followUpQueue ?? []
      const beforeSteering = get().chats[file]?.steeringQueue ?? []
      const text = before[index]
      const next = before.filter((_, itemIndex) => itemIndex !== index)
      if (text === undefined || sameQueue(before, next)) return
      try {
        await window.pi.promoteFollowUp(index, file)
        const current = get().chats[file]
        if (current && sameQueue(current.followUpQueue, before)) {
          set((state) =>
            patchChat(state, file, {
              followUpQueue: next,
              ...(sameQueue(current.steeringQueue, beforeSteering)
                ? { steeringQueue: [...beforeSteering, text] }
                : {}),
            }),
          )
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  clearQueue: async () => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]
      if (!before) return
      try {
        await window.pi.clearQueue(file)
        const current = get().chats[file]
        if (
          current &&
          sameQueue(current.steeringQueue, before.steeringQueue) &&
          sameQueue(current.followUpQueue, before.followUpQueue)
        ) {
          set((state) =>
            patchChat(state, file, {
              steeringQueue: [],
              followUpQueue: [],
            }),
          )
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  clearSteeringQueue: async () => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]?.steeringQueue ?? []
      try {
        await window.pi.clearSteeringQueue(file)
        const current = get().chats[file]?.steeringQueue
        if (current && sameQueue(current, before)) {
          set((state) => patchChat(state, file, { steeringQueue: [] }))
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  abort: async () => {
    const file = get().sessionFile
    if (!file) return
    return enqueueQueueOperation(file, async () => {
      const before = get().chats[file]
      if (!before) return
      try {
        await window.pi.abort(file)
        const current = get().chats[file]
        if (
          current &&
          sameQueue(current.steeringQueue, before.steeringQueue) &&
          sameQueue(current.followUpQueue, before.followUpQueue)
        ) {
          set((state) =>
            patchChat(state, file, {
              steeringQueue: [],
              followUpQueue: [],
            }),
          )
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    })
  },

  setModel: async (provider: string, modelId: string) => {
    try {
      const selection = await window.pi.setModel(provider, modelId)
      set({ ...selectionPatch(selection), error: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  compact: async () => {
    const file = get().sessionFile
    if (!file) return
    try {
      await window.pi.compact(file)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  setThinkingLevel: async (level: ThinkingLevel) => {
    try {
      const selection = await window.pi.setThinkingLevel(level)
      set({ ...selectionPatch(selection), error: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  listSessions: async () => {
    const cwd = get().cwd
    if (!cwd) return []
    const items = await window.pi.listSessions(cwd)
    const running = get().running
    return items.map((item) => (running.includes(item.path) ? { ...item, running: true } : item))
  },

  switchSession: async (sessionPath: string) => {
    if (get().sessionFile === sessionPath) return
    try {
      await activateSession(() => window.pi.switchSession(sessionPath))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  newSession: async () => {
    try {
      await activateSession(() => window.pi.newSession())
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  requestComposerFocus: () => set((state) => ({ focusNonce: state.focusNonce + 1 })),

  setPlanMode: (on: boolean) => {
    const file = get().sessionFile
    if (!file) return
    // Leaving Plan Mode drops the review; Build leaves it through approvePlan instead.
    set((state) => ({ ...patchChat(state, file, { planMode: on }), ...(on ? null : noPlanReview) }))
  },

  approvePlan: async () => {
    const file = get().sessionFile
    if (!file) return
    const message = formatApproval(reviewComments(get()), get().planText)
    set((state) => patchChat(state, file, { planMode: false }))
    try {
      await submitPrompt(file, message, () => window.pi.approvePlan(file, message))
    } catch (error) {
      set((state) => patchChat(state, file, { planMode: true }))
      throw error
    }
    set(noPlanReview)
  },

  refreshPlan: async (open = false) => {
    const { sessionFile } = get()
    const path = activeChat(get()).plan?.path
    if (!path) {
      set({ planText: '', planSource: '', planViewer: false })
      return
    }
    const text = await window.pi.readPlan(path)
    // A newer refresh may be reading another plan by now; keep only the current one's text.
    if (get().sessionFile !== sessionFile || activeChat(get()).plan?.path !== path) return
    set((state) => {
      // A built plan has nothing new to review, so it never pops up on its own.
      const planViewer = state.planViewer || (open && text !== '' && !activeChat(state).plan?.built)
      // Comments belong to the plan they were made on; a new plan file starts without them.
      if (state.planSource !== path) {
        return { ...noPlanReview, planText: text, planSource: path, planViewer }
      }
      const body = parsePlan(text).body
      return {
        planText: text,
        planViewer,
        planComments: reanchor(state.planComments, body),
        planDraft: state.planDraft && reanchor([state.planDraft], body)[0]!,
      }
    })
  },

  setPlanDraft: (draft: PlanComment | null) => set({ planDraft: draft }),
  commitPlanDraft: () => set((state) => ({ planComments: reviewComments(state), planDraft: null })),
  removePlanComment: (id: string) =>
    set((state) => ({ planComments: state.planComments.filter((item) => item.id !== id) })),

  sendPlanFeedback: async (note: string) => {
    const message = formatPlanFeedback(reviewComments(get()), note, get().planText)
    if (!message) return
    if (get().connection !== 'ready') throw new Error('Not connected')
    // Close and clear only once sent, so a failure keeps the comments and the typed note.
    await get().send(message)
    set({ ...noPlanReview, planViewer: false })
  },

  openPlanViewer: () => set({ planViewer: true }),
  closePlanViewer: () => set({ planViewer: false }),
}))

export function useChat(): ChatState
export function useChat<T>(selector: (chat: ChatState) => T): T
export function useChat<T>(selector?: (chat: ChatState) => T): ChatState | T {
  return useSession((state) => (selector ? selector(activeChat(state)) : activeChat(state)))
}

async function submitPrompt(file: string, text: string, dispatch: () => Promise<void>) {
  const optimisticMessage: AgentMessage = {
    role: 'user',
    content: [{ type: 'text', text }],
    timestamp: Date.now(),
  }
  useSession.setState((state) => {
    const running = state.running.includes(file) ? state.running : [...state.running, file]
    const next = patchChat(state, file, {
      isStreaming: true,
      turnActive: false,
      turnStartedAt: Date.now(),
      turnEndedAt: null,
      messages: [...(state.chats[file]?.messages ?? []), optimisticMessage],
    })
    return { ...next, error: null, running }
  })
  try {
    await dispatch()
  } catch (error) {
    useSession.setState((state) =>
      patchChat(
        {
          ...state,
          error: error instanceof Error ? error.message : String(error),
          running: state.running.filter((item) => item !== file),
        },
        file,
        { isStreaming: false, turnEndedAt: Date.now() },
      ),
    )
    throw error
  }
}

const activating = new SerialQueue()

async function activateSession(load: () => Promise<SessionSnapshot>) {
  await activating.enqueue(() => swapSession(load))
}

async function swapSession(load: () => Promise<SessionSnapshot>) {
  const snapshot = await load()
  useSession.setState((state) => {
    const nextFile = snapshot.state.sessionFile ?? null
    const cached = nextFile ? state.chats[nextFile] : undefined
    return applySnapshot(parkActive(state), snapshot, cached)
  })
}
