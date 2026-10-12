import { useEffect, useRef } from 'react'
import type { ToolLiveState } from '@/chat/state'
import { useSession } from '@/session/store'
import { ScrollFade } from '@/components/ui/scroll-area'
import { ActivityRow } from '../ActivityRow'
import { MarkdownBody } from '../MarkdownBody'
import { CodemodeBody } from './CodemodeBody'
import { EditDiff } from './EditDiff'
import { resolveToolViewModel, type ToolBodyModel } from './model'
import { QuestionBody } from './QuestionBody'
import { ReadFile } from './ReadFile'
import { ShellBody } from './ShellBody'
import { ToolDetails } from './ToolDetails'
import { ToolImages } from './ToolImage'

export function ToolCard({
  name,
  args,
  live,
  result,
  pending,
  animateIn,
}: {
  name: string
  args: unknown
  live?: ToolLiveState
  result?: unknown
  pending?: boolean
  animateIn?: boolean
}) {
  const cwd = useSession((state) => state.cwd)
  const scrollRef = useRef<HTMLDivElement>(null)

  const model = resolveToolViewModel({
    name,
    args,
    live,
    result,
    pending,
    cwd,
    homedir: window.pi.homedir,
  })

  const codemode = name.toLowerCase() === 'codemode'
  const streaming = Boolean(pending && !live)
  // Codemode's scroll area is the script, which only grows while its arguments stream.
  const follow = codemode ? streaming : model.running

  useEffect(() => {
    if (!follow) return
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [follow, model.body])

  return (
    <ActivityRow
      icon={model.icon}
      label={model.label}
      summary={model.summary}
      meta={model.meta}
      stats={model.stats}
      running={model.running && !codemode}
      error={model.hasError}
      defaultOpen={codemode}
      hideMetaWhenOpen={model.hideMetaWhenOpen}
      animateIn={animateIn}
    >
      {model.body ? <ToolBody body={model.body} scrollRef={scrollRef} /> : null}
    </ActivityRow>
  )
}

function ToolBody({
  body,
  scrollRef,
}: {
  body: ToolBodyModel | null
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  if (!body) return null

  switch (body.kind) {
    case 'codemode':
      return <CodemodeBody body={body} scrollRef={scrollRef} />

    case 'diff':
      return <EditDiff path={body.path} stats={body.stats} lines={body.lines} />

    case 'images':
      return (
        <div className="flex flex-col gap-2">
          {body.argsText ? (
            <ScrollFade className="max-h-32">
              <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {body.argsText}
              </pre>
            </ScrollFade>
          ) : null}
          {body.description ? (
            <div className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">
              <MarkdownBody text={body.description} />
            </div>
          ) : null}
          <div className="mt-2">
            <ToolImages images={body.images} notice={body.notice} />
          </div>
        </div>
      )

    case 'code':
      return <ReadFile preview={body} />

    case 'shell':
      return (
        <ShellBody
          command={body.command}
          resultText={body.resultText}
          error={Boolean(body.error)}
          scrollRef={scrollRef}
        />
      )

    case 'question':
      return <QuestionBody questions={body.questions} reply={body.reply} />

    case 'error':
      return (
        <p className="mt-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {body.message}
        </p>
      )

    case 'generic':
      return (
        <ToolDetails
          argsText={body.argsText ?? ''}
          resultText={body.resultText ?? ''}
          error={Boolean(body.error)}
          scrollRef={scrollRef}
        />
      )
  }
}
