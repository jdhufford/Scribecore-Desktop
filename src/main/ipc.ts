import { ipcMain } from 'electron'
import { IPC, type ActivityFilter, type ActivityInput, type Result } from '../shared/types'
import type { Repository } from './db/repository'
import { NotFoundError } from './db/repository'
import { suggestTags } from './db/suggest'
import { ValidationError } from './db/validate'
import { log } from './log'

// Every handler returns a Result instead of throwing, so the renderer gets a
// clean { code, message } rather than Electron's wrapped error string.
function wrap<T>(name: string, fn: () => T): Result<T> {
  try {
    return { ok: true, value: fn() }
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, error: { code: 'validation', message: err.message, field: err.field } }
    }
    if (err instanceof NotFoundError) {
      return { ok: false, error: { code: 'not_found', message: err.message } }
    }
    log.error(`IPC ${name} failed`, err)
    return { ok: false, error: { code: 'internal', message: 'Something went wrong. See the log for details.' } }
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asFilter(value: unknown): ActivityFilter {
  const v = asObject(value)
  return {
    search: typeof v['search'] === 'string' ? v['search'] : undefined,
    tags: Array.isArray(v['tags']) ? (v['tags'] as string[]) : undefined,
    tagMode: v['tagMode'] === 'or' ? 'or' : 'and',
    from: typeof v['from'] === 'string' && v['from'] ? v['from'] : undefined,
    to: typeof v['to'] === 'string' && v['to'] ? v['to'] : undefined,
    trash: v['trash'] === true,
  }
}

function asInput(value: unknown): ActivityInput {
  const v = asObject(value)
  return {
    date: v['date'] as string,
    task: v['task'] as string,
    notes: v['notes'] as string | null | undefined,
    tags: v['tags'] as string[] | undefined,
  }
}

/** Register data handlers. `repo()` returns the current repository (it changes after a restore). */
export function registerDataIpc(repo: () => Repository): void {
  ipcMain.handle(IPC.activitiesList, (_e, filter: unknown) =>
    wrap('activities:list', () => repo().list(asFilter(filter))),
  )
  ipcMain.handle(IPC.activitiesGet, (_e, id: unknown) =>
    wrap('activities:get', () => {
      const activity = repo().get(id as number)
      if (!activity) throw new NotFoundError()
      return activity
    }),
  )
  ipcMain.handle(IPC.activitiesCreate, (_e, input: unknown) =>
    wrap('activities:create', () => repo().create(asInput(input))),
  )
  ipcMain.handle(IPC.activitiesUpdate, (_e, id: unknown, input: unknown) =>
    wrap('activities:update', () => repo().update(id as number, asInput(input))),
  )
  ipcMain.handle(IPC.activitiesTrash, (_e, id: unknown) =>
    wrap('activities:trash', () => repo().trash(id as number)),
  )
  ipcMain.handle(IPC.activitiesRestore, (_e, id: unknown) =>
    wrap('activities:restore', () => repo().restore(id as number)),
  )
  ipcMain.handle(IPC.activitiesDeleteForever, (_e, id: unknown) =>
    wrap('activities:delete-forever', () => repo().deleteForever(id as number)),
  )
  ipcMain.handle(IPC.activitiesEmptyTrash, () => wrap('activities:empty-trash', () => repo().emptyTrash()))
  ipcMain.handle(IPC.tagsList, () => wrap('tags:list', () => repo().tags()))
  ipcMain.handle(IPC.tagsSuggest, (_e, task: unknown, notes: unknown) =>
    wrap('tags:suggest', () =>
      suggestTags(
        typeof task === 'string' ? task : '',
        typeof notes === 'string' ? notes : '',
        repo()
          .tags()
          .filter((t) => t.count > 0)
          .map((t) => t.name),
      ),
    ),
  )
}
