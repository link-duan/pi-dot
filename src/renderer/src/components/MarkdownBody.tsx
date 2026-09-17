import { code } from '@streamdown/code'
import { Streamdown } from 'streamdown'
import 'streamdown/styles.css'

const plugins = { code }
const linkSafety = { enabled: false }

export function MarkdownBody({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <Streamdown
      className="select-text"
      plugins={plugins}
      animated
      isAnimating={streaming}
      caret={streaming ? 'block' : undefined}
      linkSafety={linkSafety}
    >
      {text}
    </Streamdown>
  )
}
