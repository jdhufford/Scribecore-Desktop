// Network and navigation policy for ScribeCore Desktop.
//
// The app is local-only (SPEC section 3): the renderer may load its own bundled
// files and nothing else. The only way out to the internet is the user clicking
// a link to the project's own GitHub pages, which opens in their default browser.

export const PROJECT_URL = 'https://github.com/jdhufford/Scribecore-Desktop'
export const RELEASES_URL = `${PROJECT_URL}/releases`

/** True if `url` may be opened in the user's default browser. */
export function isAllowedExternalUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') return false
  if (parsed.username || parsed.password || parsed.port) return false
  const path = parsed.pathname.toLowerCase()
  const base = '/jdhufford/scribecore-desktop'
  return path === base || path.startsWith(`${base}/`)
}

/**
 * True if the renderer may make this request at all.
 * `devServerUrl` is the electron-vite dev server origin, only set in development.
 */
export function isAllowedRequest(url: string, devServerUrl?: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (['file:', 'data:', 'blob:', 'devtools:', 'chrome-extension:'].includes(parsed.protocol)) {
    return true
  }
  if (devServerUrl) {
    const dev = new URL(devServerUrl)
    const sameHost = parsed.hostname === dev.hostname && parsed.port === dev.port
    if (sameHost && ['http:', 'ws:'].includes(parsed.protocol)) return true
  }
  return false
}
