export type ShellTokenKind = 'command' | 'flag' | 'string' | 'operator' | 'comment' | 'text'

export interface ShellToken {
  kind: ShellTokenKind
  value: string
}

export function tokenizeShell(command: string): ShellToken[] {
  const tokens: ShellToken[] = []
  let i = 0
  let expectCommand = true

  while (i < command.length) {
    const ch = command[i]!

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      const start = i
      i++
      while (i < command.length && isSpace(command[i]!)) i++
      const value = command.slice(start, i)
      tokens.push({ kind: 'text', value })
      if (value.includes('\n') || value.includes('\r')) expectCommand = true
      continue
    }

    if (ch === '#' && (i === 0 || isSpace(command[i - 1]!))) {
      tokens.push({ kind: 'comment', value: command.slice(i) })
      break
    }

    if (ch === "'" || ch === '"') {
      const value = readString(command, i)
      tokens.push({ kind: 'string', value })
      i += value.length
      expectCommand = false
      continue
    }

    const operator = readOperator(command, i)
    if (operator) {
      tokens.push({ kind: 'operator', value: operator })
      i += operator.length
      expectCommand = operator !== '>' && operator !== '>>' && operator !== '<'
      continue
    }

    const start = i
    i++
    while (i < command.length && isWordChar(command, i)) i++
    const value = command.slice(start, i)
    if (expectCommand) {
      tokens.push({ kind: 'command', value })
      expectCommand = false
    } else if (value.startsWith('-')) {
      tokens.push({ kind: 'flag', value })
    } else {
      tokens.push({ kind: 'text', value })
    }
  }

  return tokens
}

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'
}

function readString(command: string, start: number): string {
  const quote = command[start]!
  let i = start + 1
  if (quote === "'") {
    while (i < command.length && command[i] !== "'") i++
    if (i < command.length) i++
    return command.slice(start, i)
  }
  while (i < command.length) {
    if (command[i] === '\\' && i + 1 < command.length) {
      i += 2
      continue
    }
    if (command[i] === '"') {
      i++
      break
    }
    i++
  }
  return command.slice(start, i)
}

function readOperator(command: string, i: number): string | null {
  const two = command.slice(i, i + 2)
  if (two === '&&' || two === '||' || two === '>>') return two
  const ch = command[i]
  if (ch === '|' || ch === ';' || ch === '&' || ch === '>' || ch === '<') return ch
  return null
}

function isWordChar(command: string, i: number): boolean {
  const ch = command[i]!
  if (isSpace(ch) || ch === "'" || ch === '"') return false
  if (ch === '#' && isSpace(command[i - 1]!)) return false
  return readOperator(command, i) == null
}
