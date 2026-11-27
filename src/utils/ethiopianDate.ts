/** Gregorian ↔ Ethiopian (Ethiopic) calendar helpers for display only. API still stores Gregorian ISO. */

export const ETHIOPIAN_MONTHS_EN = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miazia',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehasse',
  'Pagumen',
] as const

export type EthiopianDate = { year: number; month: number; day: number }

/** Parse date-only `YYYY-MM-DD` as local calendar day (avoids UTC day shift). */
export function parseCalendarDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (dayOnly) {
    const year = Number(dayOnly[1])
    const month = Number(dayOnly[2])
    const day = Number(dayOnly[3])
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
    return date
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isGregorianLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Ethiopian New Year (Enkutatash) in Gregorian: 11 Sep, or 12 Sep when the next Gregorian year is a leap year. */
function ethiopianNewYearOnOrBefore(gregorianYear: number): Date {
  return new Date(gregorianYear, 8, isGregorianLeap(gregorianYear + 1) ? 12 : 11)
}

/** Pagumen has 6 days when the Ethiopian year % 4 === 3; otherwise 5. */
export function daysInEthiopianMonth(year: number, month: number): number {
  if (month < 1 || month > 13) return 0
  if (month <= 12) return 30
  return year % 4 === 3 ? 6 : 5
}

/** Meskerem 1 of an Ethiopian year, as a Gregorian Date. */
export function ethiopianNewYearDate(ethYear: number): Date {
  const gregorianYear = ethYear + 7
  return ethiopianNewYearOnOrBefore(gregorianYear)
}

/** Convert Ethiopian Y/M/D to a Gregorian Date (local midnight). */
export function fromEthiopian({ year, month, day }: EthiopianDate): Date {
  const days = daysInEthiopianMonth(year, month)
  const safeDay = Math.min(Math.max(day, 1), days || 1)
  const safeMonth = Math.min(Math.max(month, 1), 13)
  const start = ethiopianNewYearDate(year)
  const delta = (safeMonth - 1) * 30 + (safeDay - 1)
  const result = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  result.setDate(result.getDate() + delta)
  return result
}

/** `YYYY-MM-DD` for API fields from a local Date. */
export function toIsoDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function ethiopianToIso({ year, month, day }: EthiopianDate): string {
  return toIsoDateString(fromEthiopian({ year, month, day }))
}

/** Convert a Gregorian calendar day to Ethiopian year / month / day. */
export function toEthiopian(date: Date): EthiopianDate {
  const year = date.getFullYear()
  const newYear = ethiopianNewYearOnOrBefore(year)
  let ethYear: number
  let start: Date
  if (date >= newYear) {
    ethYear = year - 7
    start = newYear
  } else {
    ethYear = year - 8
    start = ethiopianNewYearOnOrBefore(year - 1)
  }
  const delta = Math.round((date.getTime() - start.getTime()) / 86_400_000)
  let month = Math.floor(delta / 30) + 1
  let day = (delta % 30) + 1
  // Gregorian leap days can push one extra day into Pagumen; keep a valid 13th month.
  if (month > 13 || (month === 13 && day > 6)) {
    month = 13
    day = 6
  }
  return { year: ethYear, month, day }
}

/** e.g. "Hidar 17, 2019 E.C." */
export function formatEthiopian(value: string | Date | null | undefined): string {
  const date = parseCalendarDate(value)
  if (!date) return ''
  const { year, month, day } = toEthiopian(date)
  const monthName = ETHIOPIAN_MONTHS_EN[month - 1] ?? `Month ${month}`
  return `${monthName} ${day}, ${year} E.C.`
}

/** Short ET form for tight list rows, e.g. "Hidar 17" */
export function formatEthiopianShort(value: string | Date | null | undefined): string {
  const date = parseCalendarDate(value)
  if (!date) return ''
  const { month, day } = toEthiopian(date)
  const monthName = ETHIOPIAN_MONTHS_EN[month - 1] ?? `M${month}`
  return `${monthName} ${day}`
}

/**
 * Gregorian + Ethiopian for documentation-style display.
 * Respects the ET/GC switch: Ethiopian-first when ET is selected (default).
 * e.g. ET → "Hidar 17, 2019 E.C. (Nov 26, 2026)"
 * e.g. GC → "Nov 26, 2026 (Hidar 17, 2019 E.C.)"
 */
export function formatDateWithEthiopian(
  value: string | Date | null | undefined,
  gregorianPattern: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  calendar: 'ethiopian' | 'gregorian' = readCalendarPreference(),
): string {
  const date = parseCalendarDate(value)
  if (!date) return '—'
  const gregorian = date.toLocaleDateString('en-US', gregorianPattern)
  const ethiopian = formatEthiopian(date)
  if (!ethiopian) return gregorian
  return calendar === 'ethiopian' ? `${ethiopian} (${gregorian})` : `${gregorian} (${ethiopian})`
}

function readCalendarPreference(): 'ethiopian' | 'gregorian' {
  try {
    const raw = localStorage.getItem('archops.calendar')
    if (raw === 'gregorian' || raw === 'ethiopian') return raw
  } catch {
    /* ignore */
  }
  return 'ethiopian'
}

/** Short due-date label that follows the ET/GC switch. */
export function formatDueLabel(
  value: string | Date | null | undefined,
  calendar: 'ethiopian' | 'gregorian' = readCalendarPreference(),
): string {
  const date = parseCalendarDate(value)
  if (!date) return ''
  if (calendar === 'ethiopian') return formatEthiopianShort(date)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
