import { ansiStyleToCss, parseAnsi } from '@/lib/ansi'

/** Text an extension colored with ANSI codes, e.g. through `ctx.ui.theme`. */
export function AnsiText({ text }: { text: string }) {
  return parseAnsi(text).map((span, index) => (
    <span key={index} style={ansiStyleToCss(span.style)}>
      {span.text}
    </span>
  ))
}
