import { backend, type AuditQuery } from '@/api'
import type { AuditEvent } from '@/types'

export async function fetchAuditLogs(limit = 100): Promise<AuditEvent[]> {
  return fetchAuditEvents({ limit })
}

export async function fetchAuditEvents(query: AuditQuery): Promise<AuditEvent[]> {
  const { data, error } = await backend.audit.list(query)
  if (error) console.error('Error fetching audit logs:', error)
  return data ?? []
}
