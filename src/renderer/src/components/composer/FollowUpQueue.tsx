import { useState } from 'react'
import { CornerUpLeft, GripVertical, ListOrdered, Pencil, Trash2 } from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { Button } from '@/components/ui/button'
import { ScrollFade } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useChat, useSession } from '@/session/store'

interface QueueItem {
  id: string
  text: string
}

/** Ids stay stable across reorders: a text plus how many times it appeared before. */
function queueItems(queue: string[]): QueueItem[] {
  const seen = new Map<string, number>()
  return queue.map((text) => {
    const count = seen.get(text) ?? 0
    seen.set(text, count + 1)
    return { id: `${count}:${text}`, text }
  })
}

export function FollowUpQueue({
  onEdit,
  canEdit,
}: {
  onEdit?: (text: string, index: number) => void
  canEdit?: () => boolean
} = {}) {
  const followUpQueue = useChat((chat) => chat.followUpQueue)
  const deleteFollowUp = useSession((state) => state.deleteFollowUp)
  const promoteFollowUpToSteer = useSession((state) => state.promoteFollowUpToSteer)
  const setFollowUpQueue = useSession((state) => state.setFollowUpQueue)
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)

  if (!followUpQueue || followUpQueue.length === 0) return null

  const items = queueItems(followUpQueue)
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered =
    dragOrder?.length === items.length && dragOrder.every((id) => byId.has(id))
      ? dragOrder.map((id) => byId.get(id)!)
      : items

  const handleEdit = async (text: string, index: number) => {
    if (!onEdit || canEdit?.() === false) return
    try {
      await deleteFollowUp(index)
    } catch (error) {
      console.error('Failed to edit follow-up queue', error)
      return
    }
    onEdit(text, index)
  }

  const commitOrder = () => {
    if (!dragOrder) return
    void setFollowUpQueue(ordered.map((item) => item.text))
      .catch((error: unknown) => {
        console.error('Failed to reorder follow-up queue', error)
      })
      .finally(() => setDragOrder(null))
  }

  return (
    <div className="mb-2 w-full rounded-xl border border-border/60 bg-card/90 p-2 shadow-sm backdrop-blur-md dark:bg-card/90">
      <div className="mb-1.5 flex items-center px-1 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <ListOrdered className="size-3.5 text-muted-foreground" />
          <span>Follow-up queue</span>
        </div>
      </div>

      <ScrollFade className="max-h-40">
        <Reorder.Group
          axis="y"
          values={ordered.map((item) => item.id)}
          onReorder={setDragOrder}
          className="flex flex-col gap-1 pr-1.5"
        >
          {ordered.map((item, index) => (
            <FollowUpRow
              key={item.id}
              item={item}
              index={index}
              onDragEnd={commitOrder}
              canEdit={canEdit?.() !== false}
              onEdit={() => void handleEdit(item.text, index)}
              onPromote={() =>
                void promoteFollowUpToSteer(index).catch((error: unknown) => {
                  console.error('Failed to promote follow-up', error)
                })
              }
              onDelete={() =>
                void deleteFollowUp(index).catch((error: unknown) => {
                  console.error('Failed to delete follow-up', error)
                })
              }
            />
          ))}
        </Reorder.Group>
      </ScrollFade>
    </div>
  )
}

function FollowUpRow({
  item,
  index,
  canEdit = true,
  onEdit,
  onPromote,
  onDelete,
  onDragEnd,
}: {
  item: QueueItem
  index: number
  canEdit?: boolean
  onEdit: () => void
  onPromote: () => void
  onDelete: () => void
  onDragEnd: () => void
}) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      className="group flex items-center justify-between gap-1.5 rounded-lg border border-border/30 bg-muted/20 px-2 py-1 text-xs transition-colors select-none hover:bg-muted/40"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <button
          type="button"
          aria-label="Drag to reorder"
          onPointerDown={(e) => {
            e.preventDefault()
            dragControls.start(e)
          }}
          className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className="font-mono text-[11px] text-muted-foreground">{index + 1}.</span>
        <span className="truncate text-foreground select-text" title={item.text}>
          {item.text}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-70 group-hover:opacity-100">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Send as steer"
                className="size-5 text-muted-foreground hover:text-foreground"
                onClick={onPromote}
              />
            }
          >
            <CornerUpLeft className="size-3" />
          </TooltipTrigger>
          <TooltipContent>Send as steer</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Edit follow-up"
                disabled={!canEdit}
                className="size-5 text-muted-foreground hover:text-foreground disabled:opacity-25"
                onClick={onEdit}
              />
            }
          >
            <Pencil className="size-2.5" />
          </TooltipTrigger>
          <TooltipContent>{canEdit ? 'Edit' : 'Cannot edit with unsent draft'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Delete follow-up"
                className="size-5 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
              />
            }
          >
            <Trash2 className="size-2.5" />
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </Reorder.Item>
  )
}
