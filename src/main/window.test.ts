import { describe, expect, it } from 'vitest'
import { clampCascade } from './window'

const screen = { x: 0, y: 25, width: 1440, height: 875 }

describe('clampCascade', () => {
  it('offsets down and right', () => {
    expect(clampCascade({ x: 100, y: 80, width: 960, height: 740 }, screen)).toEqual({
      x: 124,
      y: 104,
      width: 960,
      height: 740,
    })
  })

  it('stays inside the work area', () => {
    expect(clampCascade({ x: 1400, y: 800, width: 960, height: 740 }, screen)).toEqual({
      x: 480,
      y: 160,
      width: 960,
      height: 740,
    })
  })

  it('shrinks when the source is larger than the display', () => {
    expect(clampCascade({ x: 0, y: 25, width: 2000, height: 2000 }, screen)).toEqual({
      x: 0,
      y: 25,
      width: 1440,
      height: 875,
    })
  })
})
