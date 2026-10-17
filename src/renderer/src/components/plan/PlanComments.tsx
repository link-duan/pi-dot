import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react'
import { Trash2 } from 'lucide-react'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { Block, type BlockProps } from 'streamdown'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent } from '@/components/ui/popover'
import {
  planBlocks,
  sourceOffset,
  sourceRanges,
  textBoundary,
  type PlanBlock,
} from '@/lib/plan-blocks'
import type { PlanComment } from '@/lib/plan-feedback'
import { rehypeSourceOffsets } from '@/lib/rehype-source-offsets'
import { draftDirty } from '@/session/state'
import { useSession } from '@/session/store'
import { PromptEditorField } from '@/components/composer/editor/PromptEditorField'
import { promptEditorConfig } from '@/components/composer/editor/prompt-editor'
import { PromptSubmitPlugin } from '@/components/composer/editor/PromptSubmitPlugin'
import { MarkdownBody } from '@/components/transcript/MarkdownBody'

type Span = Pick<PlanComment, 'start' | 'end'>

interface DocContext {
  blocks: PlanBlock[]
  owners: Map<string, number>
  comments: PlanComment[]
  readOnly: boolean
  /** Room for the rail beside the text; matches PlanViewer's `lg:` layout. */
  wide: boolean
  /** Marks the comment whose quote is emphasized, e.g. while its card is hovered. */
  setActive: (id: string | null) => void
}

const Doc = createContext<DocContext | null>(null)
const commentConfig = promptEditorConfig('pi-plan-comment')
/** Space between stacked cards in the rail. */
const RAIL_GAP = 8
/** Room for the rail beside the text; matches PlanViewer's `lg:` layout. */
const wideQuery = window.matchMedia('(min-width: 64rem)')

function subscribeWide(onChange: () => void): () => void {
  wideQuery.addEventListener('change', onChange)
  return () => wideQuery.removeEventListener('change', onChange)
}

/** The block a range ending at `end` belongs to: the last block starting before its last char. */
function ownerOf(blocks: PlanBlock[], end: number): number {
  let owner = 0
  blocks.forEach((block, index) => {
    if (block.start <= end - 1) owner = index
  })
  return owner
}

/** Turns a saved comment's card into its editor, unless that would drop typing in another draft. */
export function editPlanComment(comment: PlanComment): void {
  const session = useSession.getState()
  if (!draftDirty(session)) session.setPlanDraft({ ...comment })
}

/**
 * Plan body with inline comments: select text to comment in a popover; saved comments sit in a
 * rail beside the text they quote, or after their block when the window is too narrow for it,
 * and are edited in place.
 */
export function PlanDocument({ body, readOnly = false }: { body: string; readOnly?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const comments = useSession((state) => state.planComments)
  const draft = useSession((state) => state.planDraft)
  const setPlanDraft = useSession((state) => state.setPlanDraft)
  const [active, setActive] = useState<string | null>(null)
  const wide = useSyncExternalStore(subscribeWide, () => wideQuery.matches)
  const blocks = useMemo(() => planBlocks(body), [body])
  const parse = useCallback(() => blocks.map((block) => block.text), [blocks])

  const context = useMemo<DocContext>(
    () => ({
      blocks,
      owners: new Map(comments.map((comment) => [comment.id, ownerOf(blocks, comment.end)])),
      comments,
      readOnly,
      wide,
      setActive,
    }),
    [blocks, comments, readOnly, wide],
  )

  const current = useMemo(() => comments.filter((comment) => !comment.outdated), [comments])
  // Only where the draft sits matters below, not its text, so typing doesn't redo the highlights.
  const draftId = draft?.id
  const draftStart = draft && !draft.outdated ? draft.start : -1
  const draftEnd = draft?.end ?? -1

  // Highlight what each comment (and the open draft) quotes, without touching the DOM.
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof Highlight === 'undefined') return
    const rangesOf = (anchors: Span[]) =>
      anchors.flatMap((anchor) => sourceRanges(root, anchor.start, anchor.end))
    // The draft is emphasized once, whether it's new or editing the hovered comment.
    const focused: Span[] = current.filter(
      (comment) => comment.id === active && comment.id !== draftId,
    )
    if (draftStart >= 0) focused.push({ start: draftStart, end: draftEnd })
    CSS.highlights.set('plan-comment', new Highlight(...rangesOf(current)))
    const emphasis = new Highlight(...rangesOf(focused))
    emphasis.priority = 1
    CSS.highlights.set('plan-comment-active', emphasis)
    return () => {
      CSS.highlights.delete('plan-comment')
      CSS.highlights.delete('plan-comment-active')
    }
  }, [blocks, current, draftId, draftStart, draftEnd, active])

  const onMouseUp = () => {
    // Typing in a draft outlives a stray selection; it's dropped with Esc or Cancel.
    if (readOnly || draftDirty(useSession.getState())) return
    const root = rootRef.current
    const selection = window.getSelection()
    if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (!root.contains(range.commonAncestorContainer)) return
    // Comment cards sit inside the document but aren't plan text.
    if (inThread(range.startContainer) || inThread(range.endContainer)) return
    const [startNode, startOffset] = textBoundary(
      root,
      range.startContainer,
      range.startOffset,
      'start',
    )
    const [endNode, endOffset] = textBoundary(root, range.endContainer, range.endOffset, 'end')
    let start = sourceOffset(startNode, startOffset, 'start')
    let end = sourceOffset(endNode, endOffset, 'end')
    if (start == null || end == null) return
    while (start < end && /\s/.test(body[start]!)) start++
    while (end > start && /\s/.test(body[end - 1]!)) end--
    if (end <= start) return
    setPlanDraft({ id: crypto.randomUUID(), text: '', start, end, quote: body.slice(start, end) })
    selection.removeAllRanges()
  }

  const outdated = comments.filter((comment) => comment.outdated)

  return (
    <Doc.Provider value={context}>
      <div
        ref={rootRef}
        data-plan-document=""
        data-prose=""
        className="relative"
        onMouseUp={onMouseUp}
      >
        {outdated.length > 0 ? (
          <div className="mb-8 flex flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground">Outdated comments</div>
            {outdated.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>
        ) : null}
        <MarkdownBody text={body} BlockComponent={SourceBlock} parseMarkdownIntoBlocksFn={parse} />
        {wide && current.length > 0 ? <CommentRail comments={current} /> : null}
        {draft && !readOnly && !comments.some((comment) => comment.id === draft.id) ? (
          <CommentPopover rootRef={rootRef} draft={draft} />
        ) : null}
      </div>
    </Doc.Provider>
  )
}

type Plugins = NonNullable<BlockProps['rehypePlugins']>
const sourceOffsetPlugins = new WeakMap<Plugins, Plugins>()

/** Streamdown's plugins plus ours, stable per input so `Block` stays memoized. */
function withSourceOffsets(plugins: Plugins): Plugins {
  let next = sourceOffsetPlugins.get(plugins)
  if (!next) {
    next = [...plugins, rehypeSourceOffsets]
    sourceOffsetPlugins.set(plugins, next)
  }
  return next
}

function inThread(node: Node): boolean {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
  return !!element?.closest('[data-plan-thread]')
}

function SourceBlock(props: BlockProps) {
  const doc = useContext(Doc)!
  const block = doc.blocks[props.index]!
  // Narrow windows have no room for the rail: comments follow their block instead.
  const comments = doc.wide
    ? []
    : doc.comments.filter(
        (comment) => !comment.outdated && doc.owners.get(comment.id) === props.index,
      )

  return (
    <div data-plan-block="" data-start={block.start} data-end={block.end}>
      <Block {...props} rehypePlugins={withSourceOffsets(props.rehypePlugins ?? [])} />
      {comments.length > 0 ? (
        <div className="my-3 flex flex-col gap-2">
          {comments.map((comment) => (
            <CommentCard key={comment.id} comment={comment} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Cards beside the text they quote; a card that would overlap the one above slides down. */
function CommentRail({ comments }: { comments: PlanComment[] }) {
  const railRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    // The document root; its ref isn't attached yet when this first runs.
    const rail = railRef.current!
    const root = rail.parentElement!
    const layout = () => {
      const top = root.getBoundingClientRect().top
      const cards = [...rail.children].map((card, index) => {
        const comment = comments[index]!
        const rect = sourceRanges(root, comment.start, comment.end)[0]?.getBoundingClientRect()
        return { card: card as HTMLElement, target: rect ? rect.top - top : 0 }
      })
      cards.sort((a, b) => a.target - b.target)
      let bottom = -Infinity
      for (const { card, target } of cards) {
        const y = Math.max(target, bottom + RAIL_GAP)
        card.style.top = `${y}px`
        bottom = y + card.offsetHeight
      }
    }
    layout()
    // The plan reflows as it renders and as the window resizes; cards grow as they wrap.
    const observer = new ResizeObserver(layout)
    observer.observe(root)
    for (const card of rail.children) observer.observe(card)
    return () => observer.disconnect()
  }, [comments])

  return (
    <div ref={railRef} className="absolute inset-y-0 left-[calc(100%+2rem)] w-(--rail)">
      {comments.map((comment) => (
        <CommentCard key={comment.id} comment={comment} className="absolute inset-x-0" />
      ))}
    </div>
  )
}

export function Quote({ text }: { text: string }) {
  return (
    <div className="truncate border-l-2 border-plan/60 pl-2 text-xs text-muted-foreground">
      {text}
    </div>
  )
}

/** A saved comment: what it quotes and says; click to edit it right here. */
function CommentCard({ comment, className }: { comment: PlanComment; className?: string }) {
  const { readOnly, setActive } = useContext(Doc)!
  const draft = useSession((state) => (state.planDraft?.id === comment.id ? state.planDraft : null))

  return (
    <div
      data-plan-thread=""
      data-plan-comment={draft ? '' : undefined}
      data-comment-id={comment.id}
      className={cn(
        'rounded-xl bg-card px-3 py-2.5 text-[13px] leading-relaxed shadow-xs ring-1 ring-foreground/10 transition-shadow',
        !readOnly && !draft && 'cursor-pointer hover:shadow-md hover:ring-plan/40',
        draft && 'shadow-md ring-plan/60',
        className,
      )}
      onMouseEnter={() => setActive(comment.id)}
      onMouseLeave={() => setActive(null)}
      onClick={readOnly || draft ? undefined : () => editPlanComment(comment)}
    >
      <Quote text={comment.quote} />
      {draft ? (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <CommentEditor key={draft.id} draft={draft} />
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-foreground">{comment.text}</p>
      )}
    </div>
  )
}

/** A new comment's draft, in a popover under the text it quotes. */
function CommentPopover({
  rootRef,
  draft,
}: {
  rootRef: RefObject<HTMLDivElement | null>
  draft: PlanComment
}) {
  const setPlanDraft = useSession((state) => state.setPlanDraft)
  const anchor = useMemo(
    () => ({
      get contextElement() {
        return rootRef.current ?? undefined
      },
      getBoundingClientRect: () => {
        const root = rootRef.current
        const ranges = root ? sourceRanges(root, draft.start, draft.end) : []
        return (ranges.at(-1) ?? root)?.getBoundingClientRect() ?? new DOMRect()
      },
    }),
    [rootRef, draft.start, draft.end],
  )

  return (
    <Popover
      open
      onOpenChange={(open, details) => {
        if (open) return
        // A stray click shouldn't throw away what was typed; Esc and Cancel still do.
        const dismissed = details.reason === 'outside-press' || details.reason === 'focus-out'
        if (dismissed && draftDirty(useSession.getState())) return
        setPlanDraft(null)
      }}
    >
      <PopoverContent
        anchor={anchor}
        side="bottom"
        align="start"
        sideOffset={6}
        initialFocus={false}
        finalFocus={false}
        className="w-80 gap-1.5 p-2"
        data-plan-thread=""
        data-plan-comment=""
      >
        <Quote text={draft.quote} />
        {/* A new selection is a new draft: remount so typed text never moves to another quote. */}
        <CommentEditor key={draft.id} draft={draft} />
      </PopoverContent>
    </Popover>
  )
}

function CommentEditor({ draft }: { draft: PlanComment }) {
  // Reopening the viewer brings back what was typed (chips come back as their text tokens).
  const [config] = useState(() => ({
    ...commentConfig,
    editorState: () => {
      const paragraph = $createParagraphNode()
      if (draft.text) paragraph.append($createTextNode(draft.text))
      $getRoot().append(paragraph)
    },
  }))
  return (
    <LexicalComposer initialConfig={config}>
      <CommentEditorForm draft={draft} />
    </LexicalComposer>
  )
}

function CommentEditorForm({ draft }: { draft: PlanComment }) {
  const [editor] = useLexicalComposerContext()
  const setPlanDraft = useSession((state) => state.setPlanDraft)
  const commitPlanDraft = useSession((state) => state.commitPlanDraft)
  const removePlanComment = useSession((state) => state.removePlanComment)
  const saved = useSession((state) => state.planComments.some((item) => item.id === draft.id))
  const cancel = useCallback(() => setPlanDraft(null), [setPlanDraft])

  useEffect(() => {
    editor.focus()
  }, [editor])

  return (
    <>
      <div className="relative -mx-1.5">
        <PromptEditorField
          placeholder="Add a comment…"
          className="block max-h-48 min-h-[calc(1lh+0.75rem)] w-full overflow-y-auto px-1.5 py-1.5 leading-relaxed text-foreground outline-none"
          onChange={(text) => {
            // Read the latest draft: a refresh may have re-anchored it since this render.
            const current = useSession.getState().planDraft
            if (current?.id === draft.id) setPlanDraft({ ...current, text })
          }}
        />
      </div>
      <div className="flex items-center gap-1">
        {saved ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label="Delete comment"
            title="Delete comment"
            onClick={() => {
              removePlanComment(draft.id)
              cancel()
            }}
          >
            <Trash2 />
          </Button>
        ) : null}
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="xs" onClick={cancel}>
          Cancel
        </Button>
        <Button type="button" size="xs" disabled={!draft.text.trim()} onClick={commitPlanDraft}>
          {saved ? 'Save' : 'Comment'}
        </Button>
      </div>
      <PromptSubmitPlugin onSubmit={commitPlanDraft} onEscape={cancel} />
    </>
  )
}
