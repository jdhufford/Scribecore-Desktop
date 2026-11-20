import { DEFAULT_SETTINGS, type Settings } from '../shared/types'
import type { Repository } from './db/repository'
import { ValidationError } from './db/validate'

// User preferences, stored as rows in the `settings` table. Only known keys
// with known values are accepted from the renderer.

const ALLOWED: { [K in keyof Settings]: readonly Settings[K][] } = {
  theme: ['system', 'light', 'dark'],
  viewMode: ['normal', 'compact'],
  tagMode: ['and', 'or'],
}

export function isSettingKey(key: unknown): key is keyof Settings {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(ALLOWED, key)
}

export function readSettings(repo: Repository): Settings {
  const out = { ...DEFAULT_SETTINGS }
  for (const key of Object.keys(ALLOWED) as (keyof Settings)[]) {
    const stored = repo.getSetting(key)
    if (stored !== null && (ALLOWED[key] as readonly string[]).includes(stored)) {
      ;(out as Record<string, string>)[key] = stored
    }
  }
  return out
}

export function writeSetting(repo: Repository, key: unknown, value: unknown): Settings {
  if (!isSettingKey(key)) throw new ValidationError(`Unknown setting: ${String(key)}`, 'key')
  if (typeof value !== 'string' || !(ALLOWED[key] as readonly string[]).includes(value)) {
    throw new ValidationError(`Invalid value for ${key}`, 'value')
  }
  repo.setSetting(key, value)
  return readSettings(repo)
}
