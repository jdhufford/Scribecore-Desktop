// Remember window size, position and maximized state (SPEC 10). Pure logic,
// so it can be tested without Electron.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowState {
  bounds: Rect
  maximized: boolean
}

export const MIN_WIDTH = 900
export const MIN_HEIGHT = 600
export const DEFAULT_SIZE = { width: 1200, height: 800 }

function isRect(v: unknown): v is Rect {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return ['x', 'y', 'width', 'height'].every((k) => typeof r[k] === 'number' && Number.isFinite(r[k]))
}

export function parseWindowState(json: string | null): WindowState | null {
  if (!json) return null
  try {
    const v = JSON.parse(json) as Record<string, unknown>
    if (!isRect(v['bounds'])) return null
    return { bounds: v['bounds'], maximized: v['maximized'] === true }
  } catch {
    return null
  }
}

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * The bounds to open with: the saved ones if enough of the window (its title bar
 * area, at least 100x50 px) is on a connected display, otherwise null (centre on
 * the primary display). Sizes are clamped to the minimum and to the work area.
 */
export function restoreBounds(saved: WindowState | null, workAreas: Rect[]): Rect | null {
  if (!saved) return null
  const b = saved.bounds
  const titleBar: Rect = { x: b.x, y: b.y, width: b.width, height: 50 }
  const area = workAreas.find((wa) => overlap(titleBar, wa) >= 100 * 50)
  if (!area) return null
  return {
    x: b.x,
    y: b.y,
    width: Math.min(Math.max(b.width, MIN_WIDTH), area.width),
    height: Math.min(Math.max(b.height, MIN_HEIGHT), area.height),
  }
}
