import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProjectTrustStore } from '@earendil-works/pi-coding-agent'
import { describe, expect, it } from 'vitest'
import { trustDecision, trustResources } from './trust'

function setup(defaultTrust?: string) {
  const root = mkdtempSync(join(tmpdir(), 'pi-dot-trust-'))
  const agentDir = join(root, 'agent')
  const cwd = join(root, 'project')
  mkdirSync(agentDir)
  mkdirSync(join(cwd, '.pi', 'extensions'), { recursive: true })
  writeFileSync(join(cwd, '.pi', 'extensions', 'demo.ts'), 'export default () => {}')
  if (defaultTrust) {
    writeFileSync(
      join(agentDir, 'settings.json'),
      JSON.stringify({ defaultProjectTrust: defaultTrust }),
    )
  }
  return { root, agentDir, cwd }
}

describe('trustDecision', () => {
  it('trusts a folder without project resources', () => {
    const { root, agentDir } = setup()
    const plain = join(root, 'plain')
    mkdirSync(plain)
    expect(trustDecision(plain, agentDir)).toBe('trusted')
  })

  it('asks by default, follows the default setting, and prefers a saved answer', () => {
    expect(trustDecision(setup().cwd, setup().agentDir)).toBe('ask')
    const always = setup('always')
    expect(trustDecision(always.cwd, always.agentDir)).toBe('trusted')
    const never = setup('never')
    expect(trustDecision(never.cwd, never.agentDir)).toBe('untrusted')
    new ProjectTrustStore(never.agentDir).set(never.cwd, true)
    expect(trustDecision(never.cwd, never.agentDir)).toBe('trusted')
  })

  it('lists the resources that need trust', () => {
    expect(trustResources(setup().cwd)).toEqual(['.pi/extensions'])
  })
})
