import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Minimal local log (SPEC 6): <data dir>\logs\main.log, rotated at 1 MB, three
// old files kept. Never pass entry text (tasks, notes, tags) to these functions.

const MAX_BYTES = 1_000_000
const KEEP = 3

let logFile: string | null = null

export function initLog(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true })
    logFile = join(dir, 'main.log')
  } catch {
    logFile = null
  }
}

function rotate(file: string): void {
  try {
    if (statSync(file).size < MAX_BYTES) return
  } catch {
    return
  }
  rmSync(`${file}.${KEEP}`, { force: true })
  for (let i = KEEP - 1; i >= 1; i--) {
    try {
      renameSync(`${file}.${i}`, `${file}.${i + 1}`)
    } catch {
      /* missing is fine */
    }
  }
  renameSync(file, `${file}.1`)
}

function write(level: string, message: string, err?: unknown): void {
  const detail = err instanceof Error ? ` | ${err.name}: ${err.message}` : err ? ` | ${String(err)}` : ''
  const line = `${new Date().toISOString()} ${level} ${message}${detail}\n`
  if (level === 'ERROR') console.error(line.trimEnd())
  else console.log(line.trimEnd())
  if (!logFile) return
  try {
    rotate(logFile)
    appendFileSync(logFile, line)
  } catch {
    /* logging must never crash the app */
  }
}

export const log = {
  info: (message: string): void => write('INFO', message),
  warn: (message: string, err?: unknown): void => write('WARN', message, err),
  error: (message: string, err?: unknown): void => write('ERROR', message, err),
}
