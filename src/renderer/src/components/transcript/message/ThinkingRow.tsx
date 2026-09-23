import { useEffect, useRef, useState } from 'react'
import { Brain } from 'lucide-react'
import { ScrollFade } from '@/components/ui/scroll-area'
import { ActivityRow } from '../ActivityRow'
import { MarkdownBody } from '../MarkdownBody'

function useThinkingOpen(inProgress: boolean) {
  const [userToggled, setUserToggled] = useState<boolean | null>(null)
  const [everStarted] = useState(() => inProgress)

  const open = userToggled ?? (everStarted || inProgress)
  return [open, setUserToggled] as const
}

export function ThinkingRow({
  thinking,
  inProgress,
  animateIn,
}: {
  thinking: string
  inProgress: boolean
  animateIn?: boolean
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useThinkingOpen(inProgress)

  useEffect(() => {
    if (!inProgress || !open) return
    const node = bodyRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [inProgress, open, thinking])

  return (
    <ActivityRow
      icon={Brain}
      label={inProgress ? 'Thinking' : 'Thought'}
      summary=""
      running={inProgress}
      open={open}
      animateIn={animateIn}
      onOpenChange={setOpen}
    >
      {thinking.trim() ? (
        <div className="mt-2">
          <ScrollFade ref={bodyRef} className="max-h-80 text-muted-foreground">
            <MarkdownBody className="space-y-3" text={thinking} streaming={inProgress} />
          </ScrollFade>
        </div>
      ) : null}
    </ActivityRow>
  )
}
