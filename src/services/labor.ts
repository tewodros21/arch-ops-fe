import { backend, type LaborInput, type LaborPatch } from '@/api'
import type { AuditEvent, LaborRequest, LaborStatus } from '@/types'
import { fetchAuditEvents } from './audit'

/** The forward path a labor request moves through; cancelled sits outside it */
export const LABOR_FLOW: LaborStatus[] = ['requested', 'reviewed', 'assigned', 'in_progress', 'completed']

export const NEXT_LABOR_STATUS: Partial<Record<LaborStatus, LaborStatus>> = {
  requested: 'reviewed',
  reviewed: 'assigned',
  assigned: 'in_progress',
  in_progress: 'completed',
}

/** Quick picks for the expected duration, in working hours (1 day = 8h, 1 week = 40h) */
export const DURATION_PRESETS = [
  { label: '4h', hours: 4 },
  { label: '8h', hours: 8 },
  { label: '2 days', hours: 16 },
  { label: '1 week', hours: 40 },
]

export function formatDuration(hours: number | null | undefined) {
  if (hours == null || !Number(hours)) return null
  const h = Number(hours)
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  if (h >= 40 && h % 40 === 0) return plural(h / 40, 'week')
  if (h >= 8 && h % 8 === 0) return plural(h / 8, 'day')
  return `${h}h`
}

export function isLaborManager(role: string | undefined) {
  return role === 'admin' || role === 'general_manager' || role === 'owner'
}

export async function fetchLaborRequests(): Promise<LaborRequest[]> {
  const { data, error } = await backend.labor.list()
  if (error) console.error('Error fetching labor requests:', error)
  return data ?? []
}

export async function fetchLaborRequest(id: string): Promise<LaborRequest | null> {
  const { data } = await backend.labor.get(id)
  return data
}

export function fetchLaborHistory(id: string): Promise<AuditEvent[]> {
  return fetchAuditEvents({ entity_type: 'labor_request', entity_id: id, ascending: true })
}

/** request_number comes from the server (LR-YYYY-0001) */
export async function createLaborRequest(input: LaborInput) {
  const { error } = await backend.labor.create(input)
  return { error: error?.message ?? null }
}

export async function updateLaborRequest(id: string, patch: LaborPatch) {
  const { error } = await backend.labor.update(id, patch)
  return { error: error?.message ?? null }
}
