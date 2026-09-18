import { describe, expect, it } from 'vitest'
import { tokenizeShell, type ShellToken } from './shell-highlight'

function kinds(command: string): Array<[ShellToken['kind'], string]> {
  return tokenizeShell(command).map((token) => [token.kind, token.value])
}

describe('tokenizeShell', () => {
  it('colors the first word as the command', () => {
    expect(kinds('bun compare/render.ts')).toEqual([
      ['command', 'bun'],
      ['text', ' '],
      ['text', 'compare/render.ts'],
    ])
  })

  it('colors flags separately from arguments', () => {
    expect(kinds('ls -la --color')).toEqual([
      ['command', 'ls'],
      ['text', ' '],
      ['flag', '-la'],
      ['text', ' '],
      ['flag', '--color'],
    ])
  })

  it('keeps quoted strings together', () => {
    expect(kinds('git commit -m "hello world"')).toEqual([
      ['command', 'git'],
      ['text', ' '],
      ['text', 'commit'],
      ['text', ' '],
      ['flag', '-m'],
      ['text', ' '],
      ['string', '"hello world"'],
    ])
    expect(kinds("echo 'a b'")).toEqual([
      ['command', 'echo'],
      ['text', ' '],
      ['string', "'a b'"],
    ])
  })

  it('treats the next word after | && || ; as a command', () => {
    expect(kinds('ls | grep foo')).toEqual([
      ['command', 'ls'],
      ['text', ' '],
      ['operator', '|'],
      ['text', ' '],
      ['command', 'grep'],
      ['text', ' '],
      ['text', 'foo'],
    ])
    expect(kinds('echo hi && echo bye')).toEqual([
      ['command', 'echo'],
      ['text', ' '],
      ['text', 'hi'],
      ['text', ' '],
      ['operator', '&&'],
      ['text', ' '],
      ['command', 'echo'],
      ['text', ' '],
      ['text', 'bye'],
    ])
    expect(kinds('true || false; echo done')).toEqual([
      ['command', 'true'],
      ['text', ' '],
      ['operator', '||'],
      ['text', ' '],
      ['command', 'false'],
      ['operator', ';'],
      ['text', ' '],
      ['command', 'echo'],
      ['text', ' '],
      ['text', 'done'],
    ])
  })

  it('treats # as a comment only at a word boundary', () => {
    expect(kinds('echo foo # rest')).toEqual([
      ['command', 'echo'],
      ['text', ' '],
      ['text', 'foo'],
      ['text', ' '],
      ['comment', '# rest'],
    ])
    expect(kinds('echo foo#bar')).toEqual([
      ['command', 'echo'],
      ['text', ' '],
      ['text', 'foo#bar'],
    ])
  })

  it('treats a newline as a command separator', () => {
    expect(kinds('sleep 1\nbun -e "x"')).toEqual([
      ['command', 'sleep'],
      ['text', ' '],
      ['text', '1'],
      ['text', '\n'],
      ['command', 'bun'],
      ['text', ' '],
      ['flag', '-e'],
      ['text', ' '],
      ['string', '"x"'],
    ])
  })

  it('preserves whitespace so tokens reconstruct the command', () => {
    const command = '  ls   -l\n'
    expect(
      tokenizeShell(command)
        .map((token) => token.value)
        .join(''),
    ).toBe(command)
  })
})
