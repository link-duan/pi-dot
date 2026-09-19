import { describe, expect, it } from 'vitest'
import { keyedUserSegments, parseUserSegments } from './user-message'

describe('parseUserSegments', () => {
  it('projects an expanded skill block into a chip plus user text', () => {
    const text = [
      '<skill name="tdd" location="/tmp/tdd/SKILL.md">',
      'References are relative to /tmp/tdd.',
      '',
      'Write tests first.',
      '</skill>',
      '',
      'fix the failing test',
    ].join('\n')
    expect(parseUserSegments(text)).toEqual([
      { type: 'skill', name: 'tdd' },
      { type: 'text', text: 'fix the failing test' },
    ])
  })

  it('projects a skill block with no user text as a single chip', () => {
    const text = '<skill name="tdd" location="/tmp/tdd/SKILL.md">\nbody\n</skill>'
    expect(parseUserSegments(text)).toEqual([{ type: 'skill', name: 'tdd' }])
  })

  it('projects inline /skill: tokens', () => {
    expect(parseUserSegments('please use /skill:tdd on this file')).toEqual([
      { type: 'text', text: 'please use ' },
      { type: 'skill', name: 'tdd' },
      { type: 'text', text: ' on this file' },
    ])
  })

  it('projects multiple inline skills', () => {
    expect(parseUserSegments('/skill:tdd and /skill:react-doctor')).toEqual([
      { type: 'skill', name: 'tdd' },
      { type: 'text', text: ' and ' },
      { type: 'skill', name: 'react-doctor' },
    ])
  })

  it('does not treat unslashed skill:text as a chip', () => {
    expect(parseUserSegments('see skill:tdd and /tmp')).toEqual([
      { type: 'text', text: 'see skill:tdd and /tmp' },
    ])
  })

  it('keeps unknown skill names as chips', () => {
    expect(parseUserSegments('run /skill:gone')).toEqual([
      { type: 'text', text: 'run ' },
      { type: 'skill', name: 'gone' },
    ])
  })
})

describe('keyedUserSegments', () => {
  it('gives duplicate segments distinct keys', () => {
    const keys = keyedUserSegments('/skill:tdd then /skill:tdd').map((segment) => segment.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
