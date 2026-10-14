import { describe, expect, it } from 'vitest'
import { extensionCommand, filterSkills, filterSlashItems, slashQuery } from './slash-query'

describe('slashQuery', () => {
  it('reads a slash token at the start', () => {
    expect(slashQuery('/')).toBe('')
    expect(slashQuery('/td')).toBe('td')
    expect(slashQuery('/skill:tdd')).toBe('skill:tdd')
  })

  it('reads a slash token after whitespace', () => {
    expect(slashQuery('please use /')).toBe('')
    expect(slashQuery('please use /tdd')).toBe('tdd')
  })

  it('ignores a slash that is not at the start of a token', () => {
    expect(slashQuery('see/tmp')).toBeNull()
    expect(slashQuery('http://example.com')).toBeNull()
    expect(slashQuery('foo/bar')).toBeNull()
  })

  it('ignores a completed token after space', () => {
    expect(slashQuery('/tdd more')).toBeNull()
    expect(slashQuery('use /tdd ')).toBeNull()
  })
})

describe('filterSkills', () => {
  const skills = [
    { name: 'tdd', description: 'Test-driven development' },
    { name: 'react-doctor', description: 'Scan React diagnostics' },
  ]

  it('returns all skills for an empty query', () => {
    expect(filterSkills(skills, '')).toEqual(skills)
    expect(filterSkills(skills, 'skill:')).toEqual(skills)
  })

  it('matches name and description', () => {
    expect(filterSkills(skills, 'td').map((skill) => skill.name)).toEqual(['tdd'])
    expect(filterSkills(skills, 'react').map((skill) => skill.name)).toEqual(['react-doctor'])
    expect(filterSkills(skills, 'Scan').map((skill) => skill.name)).toEqual(['react-doctor'])
  })

  it('strips a skill: prefix from the query', () => {
    expect(filterSkills(skills, 'skill:tdd').map((skill) => skill.name)).toEqual(['tdd'])
  })
})

describe('filterSlashItems', () => {
  const skills = [{ name: 'planner', description: 'Writes plans' }, { name: 'tdd' }]
  const names = (query: string) =>
    filterSlashItems(skills, query).map((item) =>
      item.kind === 'command' ? `/${item.name}` : item.skill.name,
    )

  it('lists skills only when commands are off', () => {
    expect(filterSlashItems(skills, 'pl', null).map((item) => item.kind)).toEqual(['skill'])
  })

  it('lists commands before skills', () => {
    expect(names('')).toEqual(['/plan', '/compact', '/new', 'planner', 'tdd'])
    expect(names('pl')).toEqual(['/plan', 'planner'])
    expect(names('td')).toEqual(['tdd'])
  })

  it('lists only skills for a skill: query', () => {
    expect(names('skill:pl')).toEqual(['planner'])
  })

  it('lists extension commands and prompt templates after built-ins, dropping taken names', () => {
    const commands = [
      { name: 'deploy', description: 'Ship it', source: 'extension' as const },
      { name: 'plan', source: 'extension' as const },
      { name: 'deploy', source: 'prompt' as const },
      { name: 'review', description: 'Review staged changes', source: 'prompt' as const },
    ]
    const items = filterSlashItems([], '', commands)
    expect(items.map((item) => (item.kind === 'extension' ? item.command : item.kind))).toEqual([
      'command',
      'command',
      'command',
      commands[0],
      commands[3],
    ])
    expect(filterSlashItems([], 'staged', commands)).toEqual([
      { kind: 'extension', command: commands[3] },
    ])
  })

  it('lists only what shapes a message in the message scope', () => {
    const commands = [
      { name: 'deploy', source: 'extension' as const },
      { name: 'deploy', source: 'prompt' as const },
      { name: 'review', source: 'prompt' as const },
    ]
    const items = filterSlashItems(skills, '', commands, 'message')
    expect(
      items.map((item) =>
        item.kind === 'command'
          ? `/${item.name}`
          : item.kind === 'extension'
            ? `${item.command.source}:${item.command.name}`
            : item.skill.name,
      ),
    ).toEqual(['/plan', 'prompt:review', 'planner', 'tdd'])
  })
})

describe('extensionCommand', () => {
  const commands = [
    { name: 'deploy', source: 'extension' as const },
    { name: 'review', source: 'prompt' as const },
  ]

  it('finds the extension command a message runs', () => {
    expect(extensionCommand('/deploy staging', commands)).toBe(commands[0])
    expect(extensionCommand('/review', commands)).toBeUndefined()
    expect(extensionCommand('deploy', commands)).toBeUndefined()
  })
})
