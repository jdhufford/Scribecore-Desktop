import { describe, expect, it } from 'vitest'
import { parseWindowState, restoreBounds } from './window-state'

const primary = { x: 0, y: 0, width: 1920, height: 1040 }
const right = { x: 1920, y: 0, width: 2560, height: 1400 }

describe('parseWindowState', () => {
  it('reads valid state and rejects junk', () => {
    expect(parseWindowState('{"bounds":{"x":1,"y":2,"width":1000,"height":700},"maximized":true}')).toEqual({
      bounds: { x: 1, y: 2, width: 1000, height: 700 },
      maximized: true,
    })
    expect(parseWindowState(null)).toBeNull()
    expect(parseWindowState('not json')).toBeNull()
    expect(parseWindowState('{"bounds":{"x":"1"}}')).toBeNull()
  })
})

describe('restoreBounds', () => {
  it('keeps a window that is on screen', () => {
    const saved = { bounds: { x: 100, y: 100, width: 1200, height: 800 }, maximized: false }
    expect(restoreBounds(saved, [primary])).toEqual(saved.bounds)
  })

  it('keeps a window on a second monitor while it is connected', () => {
    const saved = { bounds: { x: 2200, y: 100, width: 1200, height: 800 }, maximized: false }
    expect(restoreBounds(saved, [primary, right])).toEqual(saved.bounds)
  })

  it('recentres when the monitor it was on is unplugged', () => {
    const saved = { bounds: { x: 2200, y: 100, width: 1200, height: 800 }, maximized: false }
    expect(restoreBounds(saved, [primary])).toBeNull()
  })

  it('recentres when only a sliver of the title bar would be visible', () => {
    const saved = { bounds: { x: 1880, y: 100, width: 1200, height: 800 }, maximized: false }
    expect(restoreBounds(saved, [primary])).toBeNull()
  })

  it('clamps sizes to the minimum and to the display', () => {
    expect(restoreBounds({ bounds: { x: 0, y: 0, width: 300, height: 200 }, maximized: false }, [primary])).toEqual({
      x: 0,
      y: 0,
      width: 900,
      height: 600,
    })
    expect(restoreBounds({ bounds: { x: 0, y: 0, width: 5000, height: 3000 }, maximized: false }, [primary])).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1040,
    })
  })

  it('handles no saved state', () => {
    expect(restoreBounds(null, [primary])).toBeNull()
  })
})
