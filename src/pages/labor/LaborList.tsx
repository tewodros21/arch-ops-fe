import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, Clock, HardHat, MapPin, Plus, UserCheck, Users } from 'lucide-react'
import { notify } from '@/lib/notify'
import { useAuth } from '@/context/AuthContext'
import { Button, LaborStatusBadge, PageHeader, useConfirm } from '@/components/ui'
import { LABOR_CREATED_EVENT, NEW_LABOR_SEARCH } from '@/constants'
import { fetchLaborRequests, formatDuration, isLaborManager, NEXT_LABOR_STATUS as NEXT, updateLaborRequest } from '@/services/labor'
import { LABOR_STATUS_LABELS, type LaborRequest, type LaborStatus } from '@/types'

const FILTERS: { key: string; label: string; statuses: LaborStatus[] | null }[] = [
  { key: 'active', label: 'Active', statuses: ['requested', 'reviewed', 'assigned', 'in_progress'] },
  { key: 'requested', label: 'Requested', statuses: ['requested'] },
  { key: 'in_progress', label: 'In progress', statuses: ['assigned', 'in_progress'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] },
  { key: 'all', label: 'All', statuses: null },
]

function AssigneeField({ labor, onSaved }: { labor: LaborRequest; onSaved: () => void }) {
  const [value, setValue] = useState(labor.assigned_to ?? '')
  const [busy, setBusy] = useState(false)
  const changed = value !== (labor.assigned_to ?? '')

  async function save() {
    setBusy(true)
    const { error } = await updateLaborRequest(labor.id, { assigned_to: value.trim() || null })
    setBusy(false)
    if (error) notify.error(`Could not update the crew lead: ${error}`)
    else {
      notify.success('Crew lead saved on this labor request')
      onSaved()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Assign a crew lead…" className="field h-10 !py-0" />
      {changed && (
        <Button variant="outline" onClick={save} loading={busy} className="h-10 px-4">
          Save
        </Button>
      )}
    </div>
  )
}

export function LaborList() {
  const { profile } = useAuth()
  const [labor, setLabor] = useState<LaborRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filterKey, setFilterKey] = useState('active')
  const navigate = useNavigate()
  const confirm = useConfirm()

  async function load() {
    setLabor(await fetchLaborRequests())
    setLoading(false)
  }

  useEffect(() => {
    load()
    // The topbar's labor modal lives in the layout; reload when it creates one
    window.addEventListener(LABOR_CREATED_EVENT, load)
    return () => window.removeEventListener(LABOR_CREATED_EVENT, load)
  }, [])

  async function advance(l: LaborRequest) {
    const next = NEXT[l.status]
    if (!next) return
    const ok = await confirm({
      title: `Move to ${LABOR_STATUS_LABELS[next].toLowerCase()}?`,
      body: `${l.request_number} · ${l.labor_type} at ${l.location}. The requester is notified.`,
      confirmLabel: `Move to ${LABOR_STATUS_LABELS[next].toLowerCase()}`,
      tone: 'accent',
    })
    if (!ok) return
    const { error } = await updateLaborRequest(l.id, { status: next })
    if (error) notify.error(`Could not move this request: ${error}`)
    else {
      notify.success(`Labor request moved to ${LABOR_STATUS_LABELS[next].toLowerCase()}`)
      load()
    }
  }

  const canAdvance = isLaborManager(profile?.role)
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0]
  const filtered = labor.filter((l) => !filter.statuses || filter.statuses.includes(l.status))
  const workers = filtered.reduce((sum, l) => sum + Number(l.workers_required ?? 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Labor requests"
        count={filtered.length}
        subtitle={`${workers} worker${workers === 1 ? '' : 's'} across ${filtered.length} request${filtered.length === 1 ? '' : 's'}`}
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button key={f.key} className="chip focus-ring" aria-pressed={f.key === filter.key} onClick={() => setFilterKey(f.key)}>
            {f.label}
            <span className="text-xs opacity-60">{labor.filter((l) => !f.statuses || f.statuses.includes(l.status)).length}</span>
          </button>
        ))}
      </div>

      {loading && <p className="py-16 text-center text-sm text-slate-500">Loading labor requests…</p>}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[1.75rem] bg-white px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--canvas)] text-slate-400">
            <HardHat size={24} />
          </span>
          <p className="text-lg font-bold text-[var(--ink)]">No labor requests here</p>
          <p className="text-sm text-slate-500">Need a crew on site? Raise a request.</p>
          <Link
            to={{ search: NEW_LABOR_SEARCH }}
            className="focus-ring mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--ink)] px-5 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Request labor
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((l) => (
          <article
            key={l.id}
            className="group flex cursor-pointer flex-col rounded-[1.5rem] bg-white transition-transform hover:-translate-y-0.5"
            onClick={() => navigate(`/labor/${l.id}`)}
          >
            <Link to={`/labor/${l.id}`} className="focus-ring block flex-1 rounded-[1.5rem] p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-2">
                <LaborStatusBadge status={l.status} />
                <span className="text-xs text-slate-400">{l.request_number}</span>
              </div>
              <p className="mt-3 text-xl font-bold text-[var(--ink)] group-hover:text-[var(--accent)]">{l.labor_type}</p>
              <p className="text-sm text-slate-500">{l.project?.name}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-[var(--ink)]">
                <span className="flex items-center gap-2 rounded-xl bg-[var(--canvas)] px-3 py-2">
                  <Users size={15} className="shrink-0 text-slate-500" />
                  {l.workers_required} workers
                </span>
                <span className="flex min-w-0 items-center gap-2 rounded-xl bg-[var(--canvas)] px-3 py-2">
                  <MapPin size={15} className="shrink-0 text-slate-500" />
                  <span className="truncate">{l.location}</span>
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--ink-soft)]">
                <span className="flex items-center gap-2">
                  <CalendarDays size={15} className="shrink-0" />
                  {format(new Date(l.required_at), 'EEE, MMM d · h:mm a')}
                </span>
                {formatDuration(l.expected_duration_hours) && (
                  <span className="flex items-center gap-2">
                    <Clock size={15} className="shrink-0" />
                    {formatDuration(l.expected_duration_hours)}
                  </span>
                )}
              </div>
              {l.assigned_to && !canAdvance && (
                <p className="mt-2 flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
                  <UserCheck size={15} className="text-[#1e8c66]" />
                  {l.assigned_to}
                </p>
              )}
            </Link>
            {canAdvance && (
              // Inline manager controls: keep clicks here from opening the detail page
              <div className="cursor-default space-y-2 border-t border-black/[0.06] p-4" onClick={(e) => e.stopPropagation()}>
                <AssigneeField labor={l} onSaved={load} />
                {NEXT[l.status] && (
                  <Button variant="outline" className="w-full" onClick={() => advance(l)}>
                    Move to {LABOR_STATUS_LABELS[NEXT[l.status]!].toLowerCase()}
                    <ArrowRight size={16} />
                  </Button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>

    </div>
  )
}
