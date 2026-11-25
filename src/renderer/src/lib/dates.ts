// Entry dates are calendar dates (YYYY-MM-DD) with no time zone. They are
// formatted in UTC so a date never shifts by a day in any time zone.

export function todayLocal(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parts(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(locale: string): Intl.DateTimeFormat {
  let f = formatters.get(locale)
  if (!f) {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }
    try {
      f = new Intl.DateTimeFormat(locale, options)
    } catch {
      f = new Intl.DateTimeFormat('en-US', options)
    }
    formatters.set(locale, f)
  }
  return f
}

/** "Fri, Nov 20, 2026" (en-US), "Fri 20 Nov 2026" (en-GB), ... Falls back to the raw text. */
export function formatDate(iso: string, locale: string): string {
  const p = parts(iso)
  if (!p) return iso
  return formatter(locale).format(new Date(Date.UTC(p[0], p[1] - 1, p[2])))
}

/** Whole days from today (local) to `iso`; positive = in the future. */
export function daysFromToday(iso: string, now = new Date()): number {
  const a = parts(iso)
  const b = parts(todayLocal(now))
  if (!a || !b) return 0
  return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 86_400_000)
}
