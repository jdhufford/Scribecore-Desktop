import type { Result } from '../../../shared/types'

export const api = window.scribecore

/** Error carrying the main process's error code and field, for inline messages. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Unwrap a Result, throwing ApiError on failure. */
export async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  const result = await promise
  if (result.ok) return result.value
  throw new ApiError(result.error.message, result.error.code, result.error.field)
}

/** True if keyboard focus is somewhere the user is typing. */
export function isEditable(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'submit', 'reset'].includes(el.type)
  return el instanceof HTMLElement && el.isContentEditable
}
