import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { differenceInCalendarDays, format } from 'date-fns'
import { ChevronRight, Inbox, Search, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { EDITABLE_STATUSES } from '@/lib/workflow'
import { fetchPurchaseRequests, PURCHASE_SAVED_EVENT } from '@/services/requests'
import { Avatar, PageHeader, StatusBadge } from '@/components/ui'
import type { PurchaseRequest, RequestStatus } from '@/types'
import { formatCurrency } from '@/utils'

const FILTERS: { key: string; label: string; statuses: RequestStatus[] | null }[] = [
  { key: 'all', label: 'All', statuses: null },
  { key: 'drafts', label: 'Drafts', statuses: ['draft', 'quote_received'] },
  { key: 'review', label: 'In review', statuses: ['awaiting_finance', 'awaiting_gm', 'awaiting_owner'] },
  { key: 'awaiting_finance', label: 'Finance', statuses: ['awaiting_finance'] },
  { key: 'awaiting_gm', label: 'GM', statuses: ['awaiting_gm'] },
  { key: 'awaiting_owner', label: 'Owner', statuses: ['awaiting_owner'] },
  { key: 'approved', label: 'Approved', statuses: ['approved'] },
  { key: 'done', label: 'Purchased & done', statuses: ['purchased', 'completed'] },
  { key: 'rejected', label: 'Rejected', statuses: ['rejected'] },
]

function dueText(r: PurchaseRequest) {
  if (!r.required_date) return null
  const diff = differenceInCalendarDays(new Date(r.required_date), new Date())
  const open = !['approved', 'purchased', 'completed', 'rejected'].includes(r.status)
  if (open && diff < 0) return { text: `Overdue ${-diff}d`, late: true }
  return { text: format(new Date(r.required_date), 'MMM d'), late: false }
}

export function RequestList() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)
  // Search and status live in the URL so the topbar search and sidebar card can drive them
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const filterKey = searchParams.get('status') ?? 'all'

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    async function load() {
      setRequests(await fetchPurchaseRequests())
      setLoading(false)
    }
    load()
    // Reload when a request is created or edited from the modal over this page
    window.addEventListener(PURCHASE_SAVED_EVENT, load)
    return () => window.removeEventListener(PURCHASE_SAVED_EVENT, load)
  }, [])

  // Employees see only their own requests; drafts stay private to their requester (and admins)
  const scoped = requests.filter((r) => {
    const mine = r.requester_id === profile?.id
    if (profile?.role === 'employee') return mine
    if (EDITABLE_STATUSES.includes(r.status)) return mine || profile?.role === 'admin'
    return true
  })
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0]
  const q = search.toLowerCase()
  const filtered = scoped.filter(
    (r) =>
      (!filter.statuses || filter.statuses.includes(r.status)) &&
      (!q || r.title.toLowerCase().includes(q) || r.request_number.toLowerCase().includes(q) || r.project?.name.toLowerCase().includes(q)),
  )
  const countFor = (f: (typeof FILTERS)[number]) => scoped.filter((r) => !f.statuses || f.statuses.includes(r.status)).length
  const total = filtered.reduce((sum, r) => sum + Number(r.estimated_amount ?? 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchase requests"
        count={filtered.length}
        subtitle={`${formatCurrency(Math.round(total))} estimated across ${filtered.length} request${filtered.length === 1 ? '' : 's'}`}
      />

      <div className="flex flex-col gap-3">
        {/* Search comes from the topbar; show it here so it can be cleared */}
        {search && (
          <button
            onClick={() => setParam('q', null)}
            className="focus-ring inline-flex w-fit items-center gap-2 rounded-full bg-[var(--ink)] py-2 pr-3 pl-4 text-sm text-white"
          >
            <Search size={15} />
            Results for “{search}”
            <X size={15} className="opacity-70" />
          </button>
        )}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTERS.map((f) => (
            <button key={f.key} className="chip focus-ring" aria-pressed={f.key === filter.key} onClick={() => setParam('status', f.key === 'all' ? null : f.key)}>
              {f.label}
              <span className="text-xs opacity-60">{countFor(f)}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-[1.75rem] bg-white">
        <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_7rem_8.5rem_1.5rem] gap-4 border-b border-black/[0.06] px-6 py-3.5 text-xs font-medium tracking-wide text-slate-500 uppercase lg:grid">
          <span>Request</span>
          <span>Project</span>
          <span>Requester</span>
          <span className="text-right">Amount</span>
          <span>Status</span>
          <span />
        </div>

        {loading && <p className="px-6 py-16 text-center text-sm text-slate-500">Loading requests…</p>}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--canvas)] text-slate-400">
              <Inbox size={24} />
            </span>
            <p className="text-lg font-bold text-[var(--ink)]">Nothing here</p>
            <p className="text-sm text-slate-500">No requests match this filter.</p>
          </div>
        )}

        <ul className="divide-y divide-black/[0.05]">
          {filtered.map((r) => {
            const due = dueText(r)
            return (
              <li key={r.id}>
                <Link
                  to={`/requests/${r.id}`}
                  className="focus-ring group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-[var(--canvas)]/60 sm:px-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_7rem_8.5rem_1.5rem]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--ink)]">{r.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      {r.request_number}
                      {due && <span className={due.late ? 'font-semibold text-[var(--accent)]' : ''}>· {due.text}</span>}
                    </p>
                  </div>
                  <p className="order-last col-span-2 truncate text-sm text-[var(--ink-soft)] lg:order-none lg:col-span-1">{r.project?.name}</p>
                  <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
                    {r.requester && <Avatar initials={r.requester.avatar_initials} index={r.requester.full_name.length} size={28} />}
                    <span className="truncate text-sm text-[var(--ink-soft)]">{r.requester?.full_name}</span>
                  </div>
                  <p className="text-right text-base font-bold text-[var(--ink)]">{formatCurrency(Number(r.estimated_amount))}</p>
                  <div className="hidden lg:block">
                    <StatusBadge status={r.status} />
                  </div>
                  <ChevronRight size={18} className="hidden text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ink)] lg:block" />
                  <div className="lg:hidden">
                    <StatusBadge status={r.status} />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
