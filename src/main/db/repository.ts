import type { Activity, ActivityFilter, ActivityInput, TagCount } from '../../shared/types'
import type { DB } from './database'
import {
  ValidationError,
  normalizeDate,
  normalizeId,
  normalizeNotes,
  normalizeTags,
  normalizeTask,
} from './validate'

export class NotFoundError extends Error {
  constructor(message = 'Entry not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export const TRASH_RETENTION_DAYS = 30

interface ActivityRow {
  id: number
  date: string
  task: string
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** All reads and writes of entries and tags. Every write is one transaction. */
export class Repository {
  constructor(
    private readonly db: DB,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private timestamp(): string {
    return this.now().toISOString()
  }

  private tagsFor(ids: number[]): Map<number, string[]> {
    const map = new Map<number, string[]>()
    if (ids.length === 0) return map
    const rows = this.db
      .prepare(
        `SELECT at.activity_id AS id, t.name AS name
         FROM activity_tags at JOIN tags t ON t.id = at.tag_id
         WHERE at.activity_id IN (SELECT value FROM json_each(?))
         ORDER BY t.name`,
      )
      .all(JSON.stringify(ids)) as { id: number; name: string }[]
    for (const r of rows) {
      const list = map.get(r.id)
      if (list) list.push(r.name)
      else map.set(r.id, [r.name])
    }
    return map
  }

  private toActivities(rows: ActivityRow[]): Activity[] {
    const tags = this.tagsFor(rows.map((r) => r.id))
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      task: r.task,
      notes: r.notes,
      tags: tags.get(r.id) ?? [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
    }))
  }

  private setTags(activityId: number, tags: string[]): void {
    this.db.prepare('DELETE FROM activity_tags WHERE activity_id = ?').run(activityId)
    const upsert = this.db.prepare(
      'INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET name = name RETURNING id',
    )
    const link = this.db.prepare('INSERT OR IGNORE INTO activity_tags (activity_id, tag_id) VALUES (?, ?)')
    for (const name of tags) {
      const { id } = upsert.get(name) as { id: number }
      link.run(activityId, id)
    }
  }

  get(id: number): Activity | null {
    const row = this.db.prepare('SELECT * FROM activities WHERE id = ?').get(normalizeId(id)) as
      | ActivityRow
      | undefined
    return row ? this.toActivities([row])[0]! : null
  }

  list(filter: ActivityFilter = {}): Activity[] {
    const where: string[] = []
    const params: unknown[] = []

    where.push(filter.trash ? 'a.deleted_at IS NOT NULL' : 'a.deleted_at IS NULL')

    const search = filter.search?.trim()
    if (search) {
      const pattern = `%${escapeLike(search)}%`
      where.push("(a.task LIKE ? ESCAPE '\\' OR a.notes LIKE ? ESCAPE '\\')")
      params.push(pattern, pattern)
    }

    const tags = normalizeTags(filter.tags ?? [])
    if (tags.length > 0) {
      const placeholders = tags.map(() => '?').join(', ')
      const having = filter.tagMode === 'or' ? '' : `HAVING count(DISTINCT t.id) = ${tags.length}`
      where.push(
        `a.id IN (SELECT at.activity_id FROM activity_tags at JOIN tags t ON t.id = at.tag_id
                  WHERE t.name IN (${placeholders}) GROUP BY at.activity_id ${having})`,
      )
      params.push(...tags)
    }

    if (filter.from) {
      where.push('a.date >= ?')
      params.push(normalizeDate(filter.from))
    }
    if (filter.to) {
      where.push('a.date <= ?')
      params.push(normalizeDate(filter.to))
    }

    const order = filter.trash
      ? 'a.deleted_at DESC, a.id DESC'
      : 'a.date DESC, a.created_at DESC, a.id DESC'
    const rows = this.db
      .prepare(`SELECT a.* FROM activities a WHERE ${where.join(' AND ')} ORDER BY ${order}`)
      .all(...params) as ActivityRow[]
    return this.toActivities(rows)
  }

  create(input: ActivityInput): Activity {
    const date = normalizeDate(input.date)
    const task = normalizeTask(input.task)
    const notes = normalizeNotes(input.notes)
    const tags = normalizeTags(input.tags)
    const ts = this.timestamp()
    const id = this.db.transaction(() => {
      const result = this.db
        .prepare(
          'INSERT INTO activities (date, task, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        )
        .run(date, task, notes, ts, ts)
      const newId = Number(result.lastInsertRowid)
      this.setTags(newId, tags)
      return newId
    })()
    return this.get(id)!
  }

  update(id: number, input: ActivityInput): Activity {
    const activityId = normalizeId(id)
    const date = normalizeDate(input.date)
    const task = normalizeTask(input.task)
    const notes = normalizeNotes(input.notes)
    const tags = normalizeTags(input.tags)
    this.db.transaction(() => {
      const result = this.db
        .prepare(
          'UPDATE activities SET date = ?, task = ?, notes = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
        )
        .run(date, task, notes, this.timestamp(), activityId)
      if (result.changes === 0) throw new NotFoundError()
      this.setTags(activityId, tags)
    })()
    return this.get(activityId)!
  }

  /** Move to Trash. */
  trash(id: number): void {
    const result = this.db
      .prepare('UPDATE activities SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
      .run(this.timestamp(), normalizeId(id))
    if (result.changes === 0) throw new NotFoundError()
  }

  restore(id: number): void {
    const result = this.db
      .prepare('UPDATE activities SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL')
      .run(normalizeId(id))
    if (result.changes === 0) throw new NotFoundError('Entry is not in Trash')
  }

  /** Permanently delete one entry. Only entries already in Trash can be deleted. */
  deleteForever(id: number): void {
    const result = this.db
      .prepare('DELETE FROM activities WHERE id = ? AND deleted_at IS NOT NULL')
      .run(normalizeId(id))
    if (result.changes === 0) throw new NotFoundError('Entry is not in Trash')
  }

  emptyTrash(): number {
    return this.db.prepare('DELETE FROM activities WHERE deleted_at IS NOT NULL').run().changes
  }

  /** Permanently delete entries that have been in Trash longer than the retention period. */
  purgeTrash(days = TRASH_RETENTION_DAYS): number {
    if (!Number.isFinite(days) || days < 0) throw new ValidationError('Invalid retention period')
    const cutoff = new Date(this.now().getTime() - days * 86_400_000).toISOString()
    return this.db
      .prepare('DELETE FROM activities WHERE deleted_at IS NOT NULL AND deleted_at < ?')
      .run(cutoff).changes
  }

  /** Every tag with its live-entry count, most used first. */
  tags(): TagCount[] {
    return this.db
      .prepare(
        `SELECT t.name AS name,
                count(a.id) AS count,
                max(a.date) AS lastUsed
         FROM tags t
         LEFT JOIN activity_tags at ON at.tag_id = t.id
         LEFT JOIN activities a ON a.id = at.activity_id AND a.deleted_at IS NULL
         GROUP BY t.id
         ORDER BY count DESC, t.name`,
      )
      .all() as TagCount[]
  }

  /** Delete tags no entry uses, counting entries in Trash so a restore keeps its tags. */
  removeUnusedTags(): number {
    return this.db
      .prepare('DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM activity_tags)')
      .run().changes
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, value)
  }
}
