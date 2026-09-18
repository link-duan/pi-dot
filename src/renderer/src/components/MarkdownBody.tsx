import { code } from '@streamdown/code'
import { Streamdown } from 'streamdown'
import 'streamdown/styles.css'

const plugins = { code }
const linkSafety = { enabled: false }
const controls = { code: { copy: true, download: false } }

export function MarkdownBody({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <Streamdown
      className="select-text"
      plugins={plugins}
      animated
      isAnimating={streaming}
      caret={streaming ? 'block' : undefined}
      lineNumbers={false}
      controls={controls}
      linkSafety={linkSafety}
    >
      {text}
    </Streamdown>
  )
}
