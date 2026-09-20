import { describe, expect, it } from 'vitest'
import { parseAnsi, type AnsiSpan } from './ansi'

const ESC = '\x1b'

function texts(spans: AnsiSpan[]): Array<[string, AnsiSpan['style']]> {
  return spans.map((span) => [span.text, span.style])
}

describe('parseAnsi', () => {
  it('returns plain text as a single span', () => {
    expect(texts(parseAnsi('hello'))).toEqual([['hello', {}]])
    expect(texts(parseAnsi('a\nb'))).toEqual([['a\nb', {}]])
  })

  it('applies palette colors and reset', () => {
    expect(texts(parseAnsi(`${ESC}[31mred${ESC}[0m plain`))).toEqual([
      ['red', { fg: { kind: 'palette', index: 1 } }],
      [' plain', {}],
    ])
    expect(texts(parseAnsi(`${ESC}[31mred${ESC}[0;32mgreen`))).toEqual([
      ['red', { fg: { kind: 'palette', index: 1 } }],
      ['green', { fg: { kind: 'palette', index: 2 } }],
    ])
  })

  it('applies bold and bright colors', () => {
    expect(texts(parseAnsi(`${ESC}[1;92mok`))).toEqual([
      ['ok', { bold: true, fg: { kind: 'palette', index: 10 } }],
    ])
  })

  it('parses 256 and truecolor', () => {
    expect(texts(parseAnsi(`${ESC}[38;5;196mhot`))).toEqual([
      ['hot', { fg: { kind: 'rgb', r: 255, g: 0, b: 0 } }],
    ])
    expect(texts(parseAnsi(`${ESC}[38;2;10;20;30mrgb`))).toEqual([
      ['rgb', { fg: { kind: 'rgb', r: 10, g: 20, b: 30 } }],
    ])
    expect(texts(parseAnsi(`${ESC}[38:5:4mblue`))).toEqual([
      ['blue', { fg: { kind: 'palette', index: 4 } }],
    ])
    expect(texts(parseAnsi(`${ESC}[38:2::10:20:30mrgb`))).toEqual([
      ['rgb', { fg: { kind: 'rgb', r: 10, g: 20, b: 30 } }],
    ])
  })

  it('overwrites the current line on carriage return', () => {
    expect(texts(parseAnsi('abc\rXY'))).toEqual([['XYc', {}]])
  })

  it('treats CRLF as a single newline', () => {
    expect(texts(parseAnsi('a\r\nb'))).toEqual([['a\nb', {}]])
  })

  it('applies backspace as a one-cell move', () => {
    expect(texts(parseAnsi('abc\b\bX'))).toEqual([['aXc', {}]])
  })

  it('erases to the end of the line', () => {
    expect(texts(parseAnsi(`abc${ESC}[K`))).toEqual([['abc', {}]])
    expect(texts(parseAnsi(`abc\r${ESC}[KXY`))).toEqual([['XY', {}]])
  })

  it('erases the whole line without moving the cursor', () => {
    expect(texts(parseAnsi(`abc${ESC}[2Kd`))).toEqual([['   d', {}]])
  })

  it('strips unknown CSI and OSC sequences', () => {
    expect(texts(parseAnsi(`${ESC}[2Jkeep${ESC}]8;;https://x${ESC}\\end`))).toEqual([
      ['keepend', {}],
    ])
  })

  it('keeps newlines after styled text', () => {
    expect(texts(parseAnsi(`${ESC}[32ma${ESC}[0m\nb`))).toEqual([
      ['a', { fg: { kind: 'palette', index: 2 } }],
      ['\nb', {}],
    ])
  })
})
