import clsx, { type ClassValue } from 'clsx'
import { formatDateWithEthiopian } from './ethiopianDate'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number | null | undefined, currency = 'ETB'): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount ?? 0)
}

/** Gregorian date with Ethiopian calendar in parentheses (for docs / UI). */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return formatDateWithEthiopian(dateString)
}

export {
  daysInEthiopianMonth,
  ethiopianToIso,
  formatDateWithEthiopian,
  formatDueLabel,
  formatEthiopian,
  formatEthiopianShort,
  fromEthiopian,
  parseCalendarDate,
  toEthiopian,
  toIsoDateString,
} from './ethiopianDate'

export function getInitials(name: string): string {
  if (!name) return ''
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

/** "Lobby" for a single-project request, "Lobby +1" when it also buys for other projects */
export function projectLabel(request: { project?: { name: string } | null; projects?: { name: string }[] }) {
  const name = request.project?.name ?? request.projects?.[0]?.name ?? ''
  const extra = (request.projects?.length ?? 1) - 1
  return extra > 0 ? `${name} +${extra}` : name
}
