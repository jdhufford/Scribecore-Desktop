import { describe, expect, it } from 'vitest'
import { daysFromToday, formatDate, todayLocal } from './dates'

describe('todayLocal', () => {
  it('uses the local calendar date, not UTC', () => {
    // 23:30 local on Nov 20 is still Nov 20 locally whatever the UTC date is.
    expect(todayLocal(new Date(2026, 10, 20, 23, 30))).toBe('2026-11-20')
    expect(todayLocal(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05')
  })
})

describe('formatDate', () => {
  it('follows the locale order and never shifts the day', () => {
    expect(formatDate('2026-11-20', 'en-US')).toBe('Fri, Nov 20, 2026')
    // Punctuation varies between ICU versions; the day/month order is what matters.
    expect(formatDate('2026-11-20', 'en-GB')).toMatch(/^Fri,? 20 Nov 2026$/)
    expect(formatDate('2026-01-01', 'de-DE')).toContain('1.')
  })

  it('falls back for a bad locale or a bad date', () => {
    expect(formatDate('2026-11-20', 'not_a_locale!!')).toBe('Fri, Nov 20, 2026')
    expect(formatDate('garbage', 'en-US')).toBe('garbage')
  })
})

describe('daysFromToday', () => {
  const now = new Date(2026, 10, 20, 12, 0)
  it('counts calendar days', () => {
    expect(daysFromToday('2026-11-20', now)).toBe(0)
    expect(daysFromToday('2026-11-22', now)).toBe(2)
    expect(daysFromToday('2026-11-19', now)).toBe(-1)
    expect(daysFromToday('2027-11-20', now)).toBe(365)
  })
})
