import { describe, expect, it } from 'vitest'
import { NotFoundError, Repository } from './repository'
import { freshDb } from './test-helpers'
import { ValidationError } from './validate'

async function setup(start = '2026-11-20T15:00:00.000Z') {
  const { db } = await freshDb()
  let now = new Date(start)
  const repo = new Repository(db, () => now)
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms)
  }
  return { db, repo, advance }
}

const DAY = 86_400_000

describe('create / get / update', () => {
  it('creates an entry with normalized fields and timestamps', async () => {
    const { repo } = await setup()
    const a = repo.create({ date: '2026-11-20', task: '  Fixed login bug ', notes: '  ', tags: ['Bugs', 'auth', 'bugs'] })
    expect(a).toMatchObject({
      date: '2026-11-20',
      task: 'Fixed login bug',
      notes: null,
      tags: ['auth', 'bugs'],
      createdAt: '2026-11-20T15:00:00.000Z',
      updatedAt: '2026-11-20T15:00:00.000Z',
      deletedAt: null,
    })
    expect(repo.get(a.id)).toEqual(a)
    expect(repo.get(9999)).toBeNull()
  })

  it('rejects invalid input without writing anything', async () => {
    const { repo } = await setup()
    expect(() => repo.create({ date: '11/20/2026', task: 'x' })).toThrow(ValidationError)
    expect(() => repo.create({ date: '2026-11-20', task: ' ' })).toThrow(ValidationError)
    expect(() => repo.create({ date: '2026-11-20', task: 'x', tags: ['a,b'] })).toThrow(ValidationError)
    expect(repo.list()).toHaveLength(0)
    expect(repo.tags()).toHaveLength(0)
  })

  it('updates fields and replaces tags', async () => {
    const { repo, advance } = await setup()
    const a = repo.create({ date: '2026-11-20', task: 'Draft', tags: ['one', 'two'] })
    advance(60_000)
    const b = repo.update(a.id, { date: '2026-11-19', task: 'Final', notes: 'done', tags: ['two', 'three'] })
    expect(b).toMatchObject({ date: '2026-11-19', task: 'Final', notes: 'done', tags: ['three', 'two'] })
    expect(b.createdAt).toBe(a.createdAt)
    expect(b.updatedAt).not.toBe(a.updatedAt)
  })

  it('cannot update a missing or trashed entry', async () => {
    const { repo } = await setup()
    expect(() => repo.update(42, { date: '2026-11-20', task: 'x' })).toThrow(NotFoundError)
    const a = repo.create({ date: '2026-11-20', task: 'x' })
    repo.trash(a.id)
    expect(() => repo.update(a.id, { date: '2026-11-20', task: 'y' })).toThrow(NotFoundError)
  })

  it('round-trips awkward text exactly', async () => {
    const { repo } = await setup()
    const notes = 'Quotes "here", commas, 100% done_ok\nSecond line\twith tab; emoji 🎉; accents café'
    const a = repo.create({ date: '2026-11-20', task: "O'Brien's <b>report</b>", notes })
    expect(repo.get(a.id)).toMatchObject({ task: "O'Brien's <b>report</b>", notes })
  })
})

describe('list', () => {
  async function seeded() {
    const ctx = await setup()
    const { repo, advance } = ctx
    const ids = {
      a: repo.create({ date: '2026-01-10', task: 'Quarterly report', tags: ['reports', 'finance'] }).id,
      b: repo.create({ date: '2026-03-05', task: 'Server patching', notes: 'Patched 50% of hosts', tags: ['ops'] }).id,
      c: repo.create({ date: '2026-03-05', task: 'Budget review', tags: ['finance'] }).id,
      d: repo.create({ date: '2025-12-31', task: 'Year-end report', tags: ['reports'] }).id,
    }
    advance(1000)
    return { ...ctx, ids }
  }

  it('orders by date, then newest created first', async () => {
    const { repo, ids } = await seeded()
    expect(repo.list().map((a) => a.id)).toEqual([ids.c, ids.b, ids.a, ids.d])
  })

  it('searches task and notes case-insensitively, treating % and _ literally', async () => {
    const { repo, ids } = await seeded()
    expect(repo.list({ search: 'REPORT' }).map((a) => a.id)).toEqual([ids.a, ids.d])
    expect(repo.list({ search: '50%' }).map((a) => a.id)).toEqual([ids.b])
    expect(repo.list({ search: '%' }).map((a) => a.id)).toEqual([ids.b])
    expect(repo.list({ search: '_' })).toEqual([])
  })

  it('filters by tags with AND (default) and OR', async () => {
    const { repo, ids } = await seeded()
    expect(repo.list({ tags: ['reports', 'finance'] }).map((a) => a.id)).toEqual([ids.a])
    expect(repo.list({ tags: ['reports', 'finance'], tagMode: 'or' }).map((a) => a.id)).toEqual([ids.c, ids.a, ids.d])
    expect(repo.list({ tags: ['Finance '] }).map((a) => a.id)).toEqual([ids.c, ids.a])
    expect(repo.list({ tags: ['nonexistent'] })).toEqual([])
  })

  it('filters by an inclusive date range', async () => {
    const { repo, ids } = await seeded()
    expect(repo.list({ from: '2026-01-01', to: '2026-03-05' }).map((a) => a.id)).toEqual([ids.c, ids.b, ids.a])
    expect(repo.list({ to: '2025-12-31' }).map((a) => a.id)).toEqual([ids.d])
    expect(() => repo.list({ from: '2026-02-30' })).toThrow(ValidationError)
  })

  it('combines filters', async () => {
    const { repo, ids } = await seeded()
    expect(repo.list({ search: 'report', tags: ['reports'], from: '2026-01-01' }).map((a) => a.id)).toEqual([ids.a])
  })
})

describe('trash', () => {
  it('hides trashed entries, lists them in Trash, and restores them', async () => {
    const { repo, advance } = await setup()
    const a = repo.create({ date: '2026-11-20', task: 'keep', tags: ['x'] })
    const b = repo.create({ date: '2026-11-20', task: 'remove', tags: ['x'] })
    advance(1000)
    repo.trash(b.id)
    expect(repo.list().map((x) => x.id)).toEqual([a.id])
    expect(repo.list({ trash: true }).map((x) => x.id)).toEqual([b.id])
    expect(repo.get(b.id)?.deletedAt).toBe('2026-11-20T15:00:01.000Z')
    expect(repo.tags()).toEqual([{ name: 'x', count: 1, lastUsed: '2026-11-20' }])
    expect(() => repo.trash(b.id)).toThrow(NotFoundError)

    repo.restore(b.id)
    expect(repo.list()).toHaveLength(2)
    expect(repo.get(b.id)?.tags).toEqual(['x'])
    expect(() => repo.restore(b.id)).toThrow(NotFoundError)
  })

  it('only deletes forever from Trash', async () => {
    const { repo } = await setup()
    const a = repo.create({ date: '2026-11-20', task: 'x', tags: ['t'] })
    expect(() => repo.deleteForever(a.id)).toThrow(NotFoundError)
    repo.trash(a.id)
    repo.deleteForever(a.id)
    expect(repo.get(a.id)).toBeNull()
  })

  it('purges entries older than 30 days in Trash, and empties Trash', async () => {
    const { repo, advance } = await setup()
    const old = repo.create({ date: '2026-10-01', task: 'old' })
    const recent = repo.create({ date: '2026-10-02', task: 'recent' })
    const live = repo.create({ date: '2026-10-03', task: 'live' })
    repo.trash(old.id)
    advance(10 * DAY)
    repo.trash(recent.id)
    advance(21 * DAY) // old: 31 days in Trash, recent: 21 days
    expect(repo.purgeTrash()).toBe(1)
    expect(repo.get(old.id)).toBeNull()
    expect(repo.get(recent.id)).not.toBeNull()
    expect(repo.emptyTrash()).toBe(1)
    expect(repo.list().map((a) => a.id)).toEqual([live.id])
  })
})

describe('tags', () => {
  it('counts live uses, reports last use, and lists unused tags', async () => {
    const { repo } = await setup()
    repo.create({ date: '2026-01-01', task: 'a', tags: ['alpha', 'beta'] })
    repo.create({ date: '2026-02-01', task: 'b', tags: ['alpha'] })
    const c = repo.create({ date: '2026-03-01', task: 'c', tags: ['gamma'] })
    repo.update(c.id, { date: '2026-03-01', task: 'c', tags: [] })
    expect(repo.tags()).toEqual([
      { name: 'alpha', count: 2, lastUsed: '2026-02-01' },
      { name: 'beta', count: 1, lastUsed: '2026-01-01' },
      { name: 'gamma', count: 0, lastUsed: null },
    ])
  })

  it('removes unused tags but keeps tags used only by entries in Trash', async () => {
    const { repo } = await setup()
    const a = repo.create({ date: '2026-01-01', task: 'a', tags: ['trashed-only'] })
    const b = repo.create({ date: '2026-01-01', task: 'b', tags: ['orphan'] })
    repo.update(b.id, { date: '2026-01-01', task: 'b', tags: [] })
    repo.trash(a.id)
    expect(repo.removeUnusedTags()).toBe(1)
    expect(repo.tags().map((t) => t.name)).toEqual(['trashed-only'])
  })
})

describe('settings', () => {
  it('stores and overwrites values', async () => {
    const { repo } = await setup()
    expect(repo.getSetting('theme')).toBeNull()
    repo.setSetting('theme', 'dark')
    repo.setSetting('theme', 'system')
    expect(repo.getSetting('theme')).toBe('system')
  })
})
