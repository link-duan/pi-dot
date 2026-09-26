import { execFileSync } from 'node:child_process'

function lastPathLine(output: string): string | undefined {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('/') && line.includes(':'))
    .at(-1)
}

/** Electron's PATH is often missing Homebrew / user bins. Use the login shell PATH instead. */
export function loginShellPath(): string {
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    const out = execFileSync(shell, ['-ilc', 'printf %s "$PATH"'], {
      encoding: 'utf8',
      timeout: 8000,
    })
    return lastPathLine(out) || process.env.PATH || ''
  } catch (error) {
    console.error('Failed to resolve login shell PATH', error)
    return process.env.PATH || ''
  }
}

export function applyAgentEnv(): void {
  const path = loginShellPath()
  if (path) process.env.PATH = path
  process.env.AI_AGENT = 'pi'
  process.env.PI_CODING_AGENT = 'true'
}
