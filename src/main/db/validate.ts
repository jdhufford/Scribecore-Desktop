// Input rules shared by every write path (UI, import, restore). See SPEC 5.3 and 7.

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export const TASK_MAX = 500
export const TAG_MAX = 50

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** A real calendar date as YYYY-MM-DD, or a ValidationError. */
export function normalizeDate(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError('Date is required', 'date')
  }
  const trimmed = value.trim()
  const m = ISO_DATE.exec(trimmed)
  if (!m) throw new ValidationError('Date must be in YYYY-MM-DD format', 'date')
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  const real = dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
  if (!real || y < 1900 || y > 2999) {
    throw new ValidationError(`${trimmed} is not a valid date`, 'date')
  }
  return trimmed
}

export function normalizeTask(value: unknown): string {
  const task = typeof value === 'string' ? value.trim() : ''
  if (!task) throw new ValidationError('Task is required', 'task')
  if (task.length > TASK_MAX) {
    throw new ValidationError(`Task must be ${TASK_MAX} characters or fewer`, 'task')
  }
  return task
}

/** Notes are optional; blank becomes null. Line breaks inside are kept. */
export function normalizeNotes(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new ValidationError('Notes must be text', 'notes')
  const notes = value.trim()
  return notes === '' ? null : notes
}

/** Lowercase, trimmed, inner whitespace collapsed, 1-50 chars, no commas. */
export function normalizeTag(value: string): string {
  const tag = value.trim().replace(/\s+/g, ' ').toLowerCase()
  if (!tag) throw new ValidationError('Tag cannot be empty', 'tags')
  if (tag.includes(',')) throw new ValidationError(`Tag "${tag}" cannot contain a comma`, 'tags')
  if (tag.length > TAG_MAX) {
    throw new ValidationError(`Tag "${tag}" is longer than ${TAG_MAX} characters`, 'tags')
  }
  return tag
}

/** Normalize a tag list: blanks skipped, duplicates dropped, order kept. */
export function normalizeTags(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new ValidationError('Tags must be a list', 'tags')
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') throw new ValidationError('Each tag must be text', 'tags')
    if (item.trim() === '') continue
    const tag = normalizeTag(item)
    if (!out.includes(tag)) out.push(tag)
  }
  return out
}

export function normalizeId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new ValidationError('Invalid id', 'id')
  }
  return value
}
