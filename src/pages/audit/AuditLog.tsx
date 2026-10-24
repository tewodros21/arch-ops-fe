import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, isToday, isYesterday } from 'date-fns'
import { Check, CircleDot, FilePlus2, HardHat, History, PackageCheck, Pencil, ShoppingBag, Undo2, UserCheck, X, type LucideIcon } from 'lucide-react'
import { Avatar, PageHeader } from '@/components/ui'
import { fetchAuditLogs } from '@/services'
import type { AuditEvent } from '@/types'

type Kind = { icon: LucideIcon; bg: string; fg: string; label: string }

function kindFor(action: string): Kind {
  if (action.endsWith('_approved')) return { icon: Check, bg: '#d3efdf', fg: '#1e8c66', label: 'Approved' }
  if (action === 'rejected') return { icon: X, bg: 'var(--accent-soft)', fg: 'var(--accent)', label: 'Rejected' }
  if (action === 'purchase_submitted') return { icon: FilePlus2, bg: 'var(--sun-soft)', fg: '#b7791f', label: 'Submitted' }
  if (action === 'purchase_created') return { icon: FilePlus2, bg: 'var(--canvas)', fg: 'var(--ink)', label: 'Draft' }
  if (action === 'purchase_updated') return { icon: Pencil, bg: 'var(--canvas)', fg: 'var(--ink)', label: 'Edited' }
  if (action === 'purchased') return { icon: ShoppingBag, bg: '#e6e1da', fg: 'var(--ink)', label: 'Purchased' }
  if (action === 'completed') return { icon: PackageCheck, bg: 'var(--ink)', fg: '#fff', label: 'Completed' }
  if (action === 'returned') return { icon: Undo2, bg: 'var(--sun-soft)', fg: 'var(--ink)', label: 'Returned' }
  if (action === 'labor_requested') return { icon: HardHat, bg: 'var(--ink)', fg: '#fff', label: 'Labor' }
  if (action === 'labor_assigned') return { icon: UserCheck, bg: '#e6e1da', fg: 'var(--ink)', label: 'Assigned' }
  if (action === 'labor_completed') return { icon: PackageCheck, bg: 'var(--ink)', fg: '#fff', label: 'Crew done' }
  if (action === 'labor_cancelled') return { icon: X, bg: 'var(--accent-soft)', fg: 'var(--accent)', label: 'Cancelled' }
  if (action.startsWith('labor_')) return { icon: HardHat, bg: 'var(--sun-soft)', fg: '#b7791f', label: 'Labor' }
  return { icon: CircleDot, bg: 'var(--canvas)', fg: 'var(--ink-soft)', label: 'Update' }
}

// Workflow endpoints store the approved/paid amount in metadata
function amountOf(e: AuditEvent): number | null {
  const m = e.metadata ?? {}
  const v = m.actual_amount ?? m.approved_amount
  return typeof v === 'number' || (typeof v === 'string' && v !== '') ? Number(v) : null
}

function dayLabel(d: Date) {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, MMM d')
}

export function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAuditLogs().then((e) => {
      setEvents(e)
      setLoading(false)
    })
  }, [])

  // Group consecutive events by calendar day (list is newest first)
  const groups: { day: string; items: AuditEvent[] }[] = []
  for (const e of events) {
    const day = dayLabel(new Date(e.created_at))
    const last = groups[groups.length - 1]
    if (last?.day === day) last.items.push(e)
    else groups.push({ day, items: [e] })
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" count={events.length} subtitle="Every action on purchase and labor requests. Read-only, nobody can edit history." />

      {loading && <p className="py-16 text-center text-sm text-slate-500">Loading activity…</p>}
      {!loading && events.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[1.75rem] bg-white px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--canvas)] text-slate-400">
            <History size={24} />
          </span>
          <p className="text-lg font-bold text-[var(--ink)]">No activity yet</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.day} className="rounded-[1.75rem] bg-white p-5 sm:p-7">
          <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{g.day}</h2>
          <ol>
            {g.items.map((e, i) => {
              const k = kindFor(e.action)
              const amount = amountOf(e)
              return (
                <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < g.items.length - 1 && <span className="absolute top-10 bottom-0 left-[1.1rem] w-px bg-black/10" />}
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: k.bg, color: k.fg }}>
                    <k.icon size={16} strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm text-[var(--ink)]">{e.description}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        {e.actor && <Avatar initials={e.actor.avatar_initials} size={20} />}
                        {e.actor?.full_name ?? 'System'}
                      </span>
                      <span>{format(new Date(e.created_at), 'h:mm a')}</span>
                      <span className="rounded-full px-2 py-0.5 font-medium" style={{ background: k.bg, color: k.fg }}>{k.label}</span>
                      {e.entity_type === 'purchase_request' && (
                        <Link to={`/requests/${e.entity_id}`} className="font-medium text-[var(--ink)] underline-offset-2 hover:underline">
                          View request
                        </Link>
                      )}
                      {e.entity_type === 'labor_request' && (
                        <Link to={`/labor/${e.entity_id}`} className="font-medium text-[var(--ink)] underline-offset-2 hover:underline">
                          View labor request
                        </Link>
                      )}
                      {amount != null && <span className="font-medium text-[var(--ink)]">${amount.toLocaleString()}</span>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
