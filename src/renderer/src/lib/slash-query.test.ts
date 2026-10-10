import { describe, expect, it } from 'vitest'
import { filterSkills, filterSlashItems, slashQuery } from './slash-query'

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
    expect(filterSlashItems(skills, 'pl', false).map((item) => item.kind)).toEqual(['skill'])
  })

  it('lists commands before skills', () => {
    expect(names('')).toEqual(['/plan', 'planner', 'tdd'])
    expect(names('pl')).toEqual(['/plan', 'planner'])
    expect(names('td')).toEqual(['tdd'])
  })

  it('lists only skills for a skill: query', () => {
    expect(names('skill:pl')).toEqual(['planner'])
  })
})
