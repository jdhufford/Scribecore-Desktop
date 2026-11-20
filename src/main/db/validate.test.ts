import { describe, expect, it } from 'vitest'
import {
  ValidationError,
  normalizeDate,
  normalizeId,
  normalizeNotes,
  normalizeTag,
  normalizeTags,
  normalizeTask,
} from './validate'

describe('normalizeDate', () => {
  it.each(['2026-11-20', ' 2026-11-20 ', '2024-02-29'])('accepts %s', (d) => {
    expect(normalizeDate(d)).toBe(d.trim())
  })

  it.each(['', '11/20/2026', '2026-1-5', '2026-02-30', '2025-02-29', '2026-13-01', '1800-01-01', 20261120, null])(
    'rejects %s',
    (d) => {
      expect(() => normalizeDate(d)).toThrow(ValidationError)
    },
  )
})

describe('normalizeTask / normalizeNotes', () => {
  it('trims and requires a task', () => {
    expect(normalizeTask('  Wrote report  ')).toBe('Wrote report')
    expect(() => normalizeTask('   ')).toThrow(ValidationError)
    expect(() => normalizeTask('x'.repeat(501))).toThrow(/500/)
  })

  it('turns blank notes into null and keeps line breaks', () => {
    expect(normalizeNotes('  ')).toBeNull()
    expect(normalizeNotes(undefined)).toBeNull()
    expect(normalizeNotes(' line 1\nline 2 ')).toBe('line 1\nline 2')
  })
})

describe('tags', () => {
  it('lowercases, trims and collapses spaces', () => {
    expect(normalizeTag('  Project   Alpha ')).toBe('project alpha')
  })

  it('rejects commas and long tags', () => {
    expect(() => normalizeTag('a,b')).toThrow(/comma/)
    expect(() => normalizeTag('x'.repeat(51))).toThrow(/50/)
  })

  it('dedupes, skips blanks and keeps order', () => {
    expect(normalizeTags(['Beta', 'alpha', ' BETA ', '', '  '])).toEqual(['beta', 'alpha'])
    expect(normalizeTags(undefined)).toEqual([])
    expect(() => normalizeTags('alpha')).toThrow(ValidationError)
  })
})

describe('normalizeId', () => {
  it('accepts positive integers only', () => {
    expect(normalizeId(7)).toBe(7)
    for (const bad of [0, -1, 1.5, '7', null, Number.NaN]) {
      expect(() => normalizeId(bad)).toThrow(ValidationError)
    }
  })
})
