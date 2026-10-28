import { differenceInCalendarDays, differenceInHours } from 'date-fns'
import type { PurchaseRequest, RequestStatus } from '@/types'
import { formatCurrency } from '@/utils'

export const COLORS = { ink: '#181412', sun: '#f6b73c', accent: '#e4532d', stone: '#8a7f78', sand: '#e6e1da' }

export const IN_REVIEW: RequestStatus[] = ['awaiting_finance', 'awaiting_gm', 'awaiting_owner']
export const DONE: RequestStatus[] = ['approved', 'purchased', 'completed']
export const PAID: RequestStatus[] = ['purchased', 'completed']

/** Hours a request can sit in one approval stage before it counts as delayed */
export const STUCK_HOURS = 48

export const AXIS_TICK = { fill: '#6b635e', fontSize: 12 }

export function money(n: number) {
  return formatCurrency(Math.round(n))
}

/** Short form for axes and tight KPI tiles: ETB 950, ETB 12k, ETB 1.2M */
export function compactMoney(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `ETB ${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (abs >= 1_000) return `ETB ${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`
  return formatCurrency(Math.round(n))
}

export function isOverdue(r: PurchaseRequest) {
  return !!r.required_date && differenceInCalendarDays(new Date(r.required_date), new Date()) < 0 && !DONE.includes(r.status)
}

export function isStuck(r: PurchaseRequest, now = new Date()) {
  return IN_REVIEW.includes(r.status) && differenceInHours(now, new Date(r.updated_at ?? r.created_at)) >= STUCK_HOURS
}

export function isDelayed(r: PurchaseRequest) {
  return r.status !== 'rejected' && (isOverdue(r) || isStuck(r))
}

/** Value signed off by approvers: the approved amount, or the estimate when none was set */
export function approvedValue(r: PurchaseRequest) {
  return DONE.includes(r.status) ? Number(r.approved_amount ?? r.estimated_amount ?? 0) : 0
}

/** Money actually paid out, once a purchase is recorded */
export function paidValue(r: PurchaseRequest) {
  return PAID.includes(r.status) ? Number(r.actual_amount ?? r.approved_amount ?? r.estimated_amount ?? 0) : 0
}
