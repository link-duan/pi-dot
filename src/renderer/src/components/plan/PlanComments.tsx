import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquarePlus, Trash2 } from 'lucide-react'
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { Block, type BlockProps } from 'streamdown'
import { Button } from '@/components/ui/button'
import {
  planBlocks,
  sourceOffset,
  sourceRanges,
  textBoundary,
  type PlanBlock,
} from '@/lib/plan-blocks'
import type { PlanComment } from '@/lib/plan-feedback'
import { rehypeSourceOffsets } from '@/lib/rehype-source-offsets'
import { useSession } from '@/session/store'
import { PromptEditorField } from '@/components/composer/editor/PromptEditorField'
import { promptEditorConfig } from '@/components/composer/editor/prompt-editor'
import { PromptSubmitPlugin } from '@/components/composer/editor/PromptSubmitPlugin'
import { MarkdownBody } from '@/components/transcript/MarkdownBody'

type Anchor = Pick<PlanComment, 'start' | 'end' | 'quote'>

interface DocContext {
  blocks: PlanBlock[]
  owners: Map<string, number>
  comments: PlanComment[]
  draft: PlanComment | null
  draftOwner: number
}

const Doc = createContext<DocContext | null>(null)
const commentConfig = promptEditorConfig('pi-plan-comment')

/** The block a range ending at `end` belongs to: the last block starting before its last char. */
function ownerOf(blocks: PlanBlock[], end: number): number {
  let owner = 0
  blocks.forEach((block, index) => {
    if (block.start <= end - 1) owner = index
  })
  return owner
}

/** Plan body with GitHub-style inline comments: select text to comment, threads sit after the block. */
export function PlanDocument({ body, readOnly = false }: { body: string; readOnly?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const comments = useSession((state) => state.planComments)
  const draft = useSession((state) => state.planDraft)
  const setPlanDraft = useSession((state) => state.setPlanDraft)
  const [bubble, setBubble] = useState<(Anchor & { top: number; left: number }) | null>(null)
  const blocks = useMemo(() => planBlocks(body), [body])
  const parse = useCallback(() => blocks.map((block) => block.text), [blocks])

  const context = useMemo<DocContext>(() => {
    const owners = new Map(comments.map((comment) => [comment.id, ownerOf(blocks, comment.end)]))
    return {
      blocks,
      owners,
      comments,
      draft,
      draftOwner: draft ? ownerOf(blocks, draft.end) : -1,
    }
  }, [blocks, comments, draft])

  useEffect(() => {
    const onChange = () => {
      if (window.getSelection()?.isCollapsed) setBubble(null)
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [])

  // Highlight what each comment (and the open draft) quotes, without touching the DOM.
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof Highlight === 'undefined') return
    const anchors: Anchor[] = comments.filter((comment) => !comment.outdated)
    if (draft && !draft.outdated) anchors.push(draft)
    const ranges = anchors.flatMap((anchor) => sourceRanges(root, anchor.start, anchor.end))
    CSS.highlights.set('plan-comment', new Highlight(...ranges))
    return () => {
      CSS.highlights.delete('plan-comment')
    }
  }, [blocks, comments, draft])

  const onMouseUp = () => {
    if (readOnly) return
    const root = rootRef.current
    const selection = window.getSelection()
    if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (!root.contains(range.commonAncestorContainer)) return
    // Comment cards and drafts sit inside blocks but aren't plan text.
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
    const rect = [...range.getClientRects()].at(-1) ?? range.getBoundingClientRect()
    const box = root.getBoundingClientRect()
    setBubble({
      start,
      end,
      quote: body.slice(start, end),
      top: rect.bottom - box.top + 6,
      left: rect.right - box.left,
    })
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
          <div className="mb-8">
            <div className="text-xs font-medium text-muted-foreground">Outdated comments</div>
            {outdated.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>
        ) : null}
        <MarkdownBody text={body} BlockComponent={SourceBlock} parseMarkdownIntoBlocksFn={parse} />
        {bubble ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="absolute z-10 -translate-x-1/2 bg-popover shadow-md dark:bg-popover dark:hover:bg-muted"
            style={{ top: bubble.top, left: bubble.left }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const { start, end, quote } = bubble
              setPlanDraft({ id: crypto.randomUUID(), text: '', start, end, quote })
              setBubble(null)
              window.getSelection()?.removeAllRanges()
            }}
          >
            <MessageSquarePlus />
            Comment
          </Button>
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
  const comments = doc.comments.filter(
    (comment) => !comment.outdated && doc.owners.get(comment.id) === props.index,
  )

  return (
    <div data-plan-block="" data-start={block.start} data-end={block.end}>
      <Block {...props} rehypePlugins={withSourceOffsets(props.rehypePlugins ?? [])} />
      {comments.map((comment) => (
        <CommentCard key={comment.id} comment={comment} />
      ))}
      {doc.draft && doc.draftOwner === props.index ? (
        // A new selection is a new draft: remount so typed text never moves to another quote.
        <CommentDraft key={doc.draft.id} draft={doc.draft} />
      ) : null}
    </div>
  )
}

function Quote({ text }: { text: string }) {
  return (
    <blockquote className="line-clamp-2 min-w-0 flex-1 border-l-2 border-plan/60 pl-2 text-xs whitespace-pre-wrap text-muted-foreground">
      {text}
    </blockquote>
  )
}

function CommentCard({ comment }: { comment: PlanComment }) {
  const removePlanComment = useSession((state) => state.removePlanComment)
  return (
    <div
      data-plan-thread=""
      className="my-3 rounded-lg border border-border bg-card px-2.5 py-2 text-sm"
    >
      <div className="flex items-start gap-2">
        <Quote text={comment.quote} />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="-mt-0.5 -mr-1 text-muted-foreground"
          aria-label="Delete comment"
          title="Delete comment"
          onClick={() => removePlanComment(comment.id)}
        >
          <Trash2 />
        </Button>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-foreground">{comment.text}</p>
    </div>
  )
}

function CommentDraft({ draft }: { draft: PlanComment }) {
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
    <div
      data-plan-thread=""
      data-plan-comment=""
      className="my-3 rounded-lg border border-border bg-card px-2.5 py-2 text-sm"
    >
      <Quote text={draft.quote} />
      <LexicalComposer initialConfig={config}>
        <CommentDraftForm draft={draft} />
      </LexicalComposer>
    </div>
  )
}

function CommentDraftForm({ draft }: { draft: PlanComment }) {
  const [editor] = useLexicalComposerContext()
  const setPlanDraft = useSession((state) => state.setPlanDraft)
  const commitPlanDraft = useSession((state) => state.commitPlanDraft)
  const cancel = useCallback(() => setPlanDraft(null), [setPlanDraft])

  useEffect(() => {
    editor.focus()
  }, [editor])

  return (
    <>
      <div className="relative -mx-1.5 mt-1">
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
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" size="xs" onClick={cancel}>
          Cancel
        </Button>
        <Button type="button" size="xs" disabled={!draft.text.trim()} onClick={commitPlanDraft}>
          Comment
        </Button>
      </div>
      <PromptSubmitPlugin onSubmit={commitPlanDraft} onEscape={cancel} />
    </>
  )
}
