import { memo, useMemo } from 'react'
import { CornerUpLeft, X } from 'lucide-react'
import { FileChip } from '@/components/composer/FileChip'
import { SkillChip } from '@/components/composer/SkillChip'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { fileChipLabel } from '@/lib/file-token'
import { keyedUserSegments } from '@/lib/user-message'

export const SteeringRow = memo(function SteeringRow({
  text,
  onCancel,
}: {
  text: string
  onCancel?: () => void
}) {
  const segments = useMemo(() => keyedUserSegments(text), [text])

  return (
    <div className="mt-6 mb-2 flex justify-end first:mt-2">
      <div className="flex max-w-[min(32rem,80%)] min-w-0 flex-col items-end">
        <div className="mb-1 flex items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <CornerUpLeft className="size-3" />
            Steering
          </span>
          {onCancel ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Cancel steering"
                    className="size-4 text-muted-foreground hover:text-destructive"
                    onClick={onCancel}
                  />
                }
              >
                <X className="size-2.5" />
              </TooltipTrigger>
              <TooltipContent>Cancel</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <div className="w-fit max-w-full rounded-xl bg-foreground/4 px-3 py-2 leading-relaxed break-words whitespace-pre-wrap text-foreground select-text dark:bg-foreground/12">
          {segments.map((segment) =>
            segment.type === 'skill' ? (
              <SkillChip key={segment.key} name={segment.name} />
            ) : segment.type === 'file' ? (
              <FileChip
                key={segment.key}
                label={fileChipLabel(segment.path, segment.range)}
                title={segment.path}
                directory={segment.path.endsWith('/')}
              />
            ) : (
              <span key={segment.key}>{segment.text}</span>
            ),
          )}
        </div>
      </div>
    </div>
  )
})
