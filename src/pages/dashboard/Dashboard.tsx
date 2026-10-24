import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { differenceInCalendarDays, format, isSameDay, startOfDay, subDays } from 'date-fns'
import { CalendarDays, Clock, HardHat, MapPin, MoreVertical } from 'lucide-react'
import { fetchAuditEvents, fetchLaborRequests, fetchPurchaseRequests } from '@/services'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/ui'
import { KpiCards } from '@/components/dashboard/KpiCards'
import { SpendCharts } from '@/components/dashboard/SpendCharts'
import { Pill } from '@/components/dashboard/kit'
import { COLORS, DONE, IN_REVIEW, isOverdue, money } from '@/components/dashboard/metrics'
import { formatDuration } from '@/services/labor'
import {
  LABOR_STATUS_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  type AuditEvent,
  type LaborRequest,
  type PurchaseRequest,
  type RequestStatus,
} from '@/types'

const AWAITING_BY_ROLE: Record<string, RequestStatus | null> = {
  employee: null,
  finance: 'awaiting_finance',
  general_manager: 'awaiting_gm',
  owner: 'awaiting_owner',
  admin: null,
}

const PIPELINE: { title: string; statuses: RequestStatus[] }[] = [
  { title: 'New', statuses: ['draft', 'quote_received'] },
  { title: 'In review', statuses: IN_REVIEW },
  { title: 'Approved', statuses: ['approved'] },
  { title: 'Completed', statuses: ['purchased', 'completed'] },
]

// How far along the approval chain a request is, for the progress bars
const PROGRESS: Record<RequestStatus, number> = {
  draft: 8,
  quote_received: 20,
  awaiting_finance: 40,
  awaiting_gm: 62,
  awaiting_owner: 84,
  approved: 100,
  rejected: 100,
  purchased: 100,
  completed: 100,
}

const HEAT_HOURS = [8, 10, 12, 14, 16, 18]
const HEAT_DAYS = 12

const SERIES = [
  { key: 'approved', name: 'Approved', color: COLORS.accent },
  { key: 'review', name: 'In review', color: COLORS.sun },
  { key: 'other', name: 'New & other', color: COLORS.ink },
] as const
const SERIES_COLORS: Record<string, string> = Object.fromEntries(SERIES.map((s) => [s.name, s.color]))

function dueLabel(date: string | null) {
  if (!date) return 'No due date'
  const diff = differenceInCalendarDays(new Date(date), new Date())
  if (diff < 0) return `Overdue ${-diff} day${diff === -1 ? '' : 's'}`
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  return `Due ${format(new Date(date), 'MMM d')}`
}

export function Dashboard() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [labor, setLabor] = useState<LaborRequest[]>([])
  const [activity, setActivity] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const since = startOfDay(subDays(new Date(), HEAT_DAYS - 1)).toISOString()
      const [reqs, laborRows, events] = await Promise.all([
        fetchPurchaseRequests(),
        fetchLaborRequests(),
        fetchAuditEvents({ since, limit: 1000 }),
      ])
      setRequests(reqs)
      setLabor(laborRows)
      setActivity(events)
      setLoading(false)
    }
    load()
  }, [])

  if (!profile) return null

  const scoped = profile.role === 'employee' ? requests.filter((r) => r.requester_id === profile.id) : requests
  const awaitingStatus = AWAITING_BY_ROLE[profile.role]
  const priority = (awaitingStatus ? requests.filter((r) => r.status === awaitingStatus) : scoped.filter((r) => !DONE.includes(r.status) && r.status !== 'rejected'))
    .slice()
    .sort((a, b) => (a.required_date ?? '9999').localeCompare(b.required_date ?? '9999'))

  // ── Request volume, last 7 days ──
  const today = startOfDay(new Date())
  const week = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i))
  const volume = week.map((day) => {
    const onDay = scoped.filter((r) => isSameDay(new Date(r.created_at), day))
    return {
      day: format(day, 'EEE'),
      approved: onDay.filter((r) => DONE.includes(r.status)).length,
      review: onDay.filter((r) => IN_REVIEW.includes(r.status)).length,
      other: onDay.filter((r) => !DONE.includes(r.status) && !IN_REVIEW.includes(r.status)).length,
    }
  })
  const thisWeek = scoped.filter((r) => new Date(r.created_at) >= week[0]).length
  const lastWeek = scoped.filter((r) => {
    const d = new Date(r.created_at)
    return d >= subDays(week[0], 7) && d < week[0]
  }).length
  const trend = lastWeek === 0 ? null : Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
  const approvedSpend = scoped
    .filter((r) => DONE.includes(r.status))
    .reduce((sum, r) => sum + Number(r.approved_amount ?? r.estimated_amount ?? 0), 0)

  // ── Activity heatmap: time slot × day ──
  const heatDays = Array.from({ length: HEAT_DAYS }, (_, i) => subDays(today, HEAT_DAYS - 1 - i))
  const heat = HEAT_HOURS.map((_, row) =>
    heatDays.map((day) =>
      activity.filter((a) => {
        const d = new Date(a.created_at)
        const h = d.getHours()
        const slot = Math.min(HEAT_HOURS.length - 1, Math.max(0, Math.floor((h - HEAT_HOURS[0]) / 2)))
        return slot === row && isSameDay(d, day)
      }).length,
    ),
  )

  const activeLabor = labor.filter((l) => !['completed', 'cancelled'].includes(l.status))

  return (
    <div className="space-y-4">
      <KpiCards profile={profile} requests={requests} scoped={scoped} labor={labor} loading={loading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[1.1fr_1.25fr_0.9fr]">
        {/* Request volume */}
        <section className="rounded-[1.75rem] bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-normal text-[var(--ink)]">Requests</h2>
              <p className="mt-1 text-xs text-slate-500">
                {trend === null ? `${thisWeek} this week` : `${trend >= 0 ? '+' : ''}${trend}% vs last week`} · {money(approvedSpend)} approved
              </p>
            </div>
            <Pill>This week</Pill>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {SERIES.map((sr) => (
              <span key={sr.key} className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)]">
                <span className="h-0.5 w-3.5 rounded-full" style={{ background: sr.color }} />
                {sr.name}
              </span>
            ))}
          </div>
          <div className="mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              {/* Remount once data arrives so the lines draw in on real values */}
              <LineChart key={loading ? 'loading' : 'ready'} data={volume} className="chart-draw" margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="rgba(24,20,18,0.08)" horizontal={false} />
                <XAxis dataKey="day" tick={{ fill: '#6b635e', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#6b635e', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<VolumeTooltip />} cursor={{ stroke: COLORS.ink, strokeOpacity: 0.3, strokeDasharray: '4 4' }} />
                {SERIES.map((sr, i) => (
                  <Line
                    key={sr.key}
                    type="monotone"
                    dataKey={sr.key}
                    name={sr.name}
                    stroke={sr.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={false}
                    activeDot={{ r: 4.5, fill: sr.color, stroke: '#fff', strokeWidth: 2 }}
                    // Drawn by the .chart-draw CSS animation instead (smoother than per-frame JS)
                    isAnimationActive={false}
                    pathLength={1}
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Team activity */}
        <section className="rounded-[1.75rem] bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-normal text-[var(--ink)]">Team activity</h2>
              <p className="mt-1 text-xs text-slate-500">{activity.length} action{activity.length === 1 ? '' : 's'} logged</p>
            </div>
            <Pill>Last 2 weeks</Pill>
          </div>
          <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-3">
            <div className="grid gap-1.5">
              {HEAT_HOURS.map((h) => (
                <span key={h} className="flex h-full items-center text-xs whitespace-nowrap text-[var(--ink-soft)]">
                  {format(new Date(2000, 0, 1, h), 'h a')}
                </span>
              ))}
              <span className="pt-1 text-xs text-[var(--ink-soft)]">{format(today, 'MMM')}</span>
            </div>
            <div className="grid gap-1.5">
              {heat.map((row, r) => (
                <div key={r} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${HEAT_DAYS}, minmax(0, 1fr))` }}>
                  {row.map((count, c) => (
                    <span
                      key={c}
                      title={`${count} action${count === 1 ? '' : 's'} · ${format(heatDays[c], 'MMM d')}, ${format(new Date(2000, 0, 1, HEAT_HOURS[r]), 'h a')}`}
                      className="aspect-square rounded-md"
                      style={{ background: count === 0 ? 'var(--cell)' : count === 1 ? COLORS.sun : COLORS.accent }}
                    />
                  ))}
                </div>
              ))}
              <div className="grid gap-1.5 pt-1" style={{ gridTemplateColumns: `repeat(${HEAT_DAYS}, minmax(0, 1fr))` }}>
                {heatDays.map((d) => (
                  <span key={d.toISOString()} className="text-center text-xs text-[var(--ink-soft)]">
                    {format(d, 'd')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Priority queue */}
        <section className="rounded-[1.75rem] bg-white p-6 lg:col-span-2 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-normal text-[var(--ink)]">{awaitingStatus ? 'Awaiting you' : 'Open requests'}</h2>
              <p className="mt-1 text-xs text-slate-500">{ROLE_LABELS[profile.role]} queue</p>
            </div>
            <span className="text-4xl font-medium text-[var(--ink)]">{priority.length}</span>
          </div>
          <div className="mt-5 space-y-5">
            {loading && <p className="text-sm text-slate-500">Loading…</p>}
            {!loading && priority.length === 0 && <p className="text-sm text-slate-500">You're all caught up.</p>}
            {priority.slice(0, 3).map((r) => (
              <Link key={r.id} to={`/requests/${r.id}`} className="focus-ring block rounded-lg">
                <p className="truncate text-[15px] text-[var(--ink)]">{r.title}</p>
                <div className="mt-0.5 flex items-center justify-between text-xs text-slate-500">
                  <span className={clsx(isOverdue(r) && 'text-[var(--accent)]')}>{dueLabel(r.required_date)}</span>
                  <span className="text-[var(--ink)]">{PROGRESS[r.status]}%</span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-[var(--cell)]">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${PROGRESS[r.status]}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Pipeline board */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PIPELINE.map((col) => {
          const items = scoped.filter((r) => col.statuses.includes(r.status))
          return (
            <div key={col.title} className="min-w-0">
              <div className="mb-3 flex items-center gap-3 px-1">
                <h3 className="text-2xl font-normal text-[var(--ink)]">{col.title}</h3>
                <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white px-2 text-sm text-[var(--ink)]">
                  {items.length}
                </span>
              </div>
              <div className="space-y-3">
                {items.slice(0, 3).map((r) => (
                  <RequestCard key={r.id} request={r} />
                ))}
                {!loading && items.length === 0 && (
                  <p className="rounded-[1.5rem] border border-dashed border-black/10 px-5 py-8 text-center text-sm text-slate-400">Nothing here</p>
                )}
                {items.length > 3 && (
                  <Link to="/requests" className="block px-1 text-sm text-[var(--ink-soft)] hover:text-[var(--accent)]">
                    +{items.length - 3} more
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <SpendCharts scoped={scoped} loading={loading} companyWide={profile.role !== 'employee'} />

      {activeLabor.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-normal text-[var(--ink)]">Labor on site</h3>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white px-2 text-sm text-[var(--ink)]">
                {activeLabor.length}
              </span>
            </div>
            <Link to="/labor" className="text-sm text-[var(--ink-soft)] hover:text-[var(--accent)]">View all</Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {activeLabor.slice(0, 4).map((l) => (
              <Link key={l.id} to={`/labor/${l.id}`} className="focus-ring block rounded-[1.5rem] bg-white p-5 transition-transform hover:-translate-y-0.5">
                <div className="flex items-center justify-between">
                  <Tag tone="sun">{LABOR_STATUS_LABELS[l.status]}</Tag>
                  <span className="text-xs text-slate-400">{l.request_number}</span>
                </div>
                <p className="mt-3 text-lg text-[var(--ink)]">{l.labor_type}</p>
                <div className="mt-2 space-y-1 text-sm text-[var(--ink-soft)]">
                  <p className="flex items-center gap-2"><HardHat size={15} /> {l.workers_required} workers</p>
                  <p className="flex items-center gap-2 truncate"><MapPin size={15} /> {l.location}</p>
                  {formatDuration(l.expected_duration_hours) && (
                    <p className="flex items-center gap-2"><Clock size={15} /> {formatDuration(l.expected_duration_hours)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function RequestCard({ request: r }: { request: PurchaseRequest }) {
  const overdue = isOverdue(r)
  const dueSoon =
    !overdue && !!r.required_date && differenceInCalendarDays(new Date(r.required_date), new Date()) <= 3 && !DONE.includes(r.status)
  const dark = overdue

  return (
    <Link
      to={`/requests/${r.id}`}
      className={clsx(
        'focus-ring block overflow-hidden rounded-[1.5rem] transition-transform hover:-translate-y-0.5',
        dark ? 'bg-[linear-gradient(160deg,#24201d,#2f2a26)] text-white' : 'bg-white',
      )}
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          {overdue ? (
            <Tag tone="sun">Overdue</Tag>
          ) : dueSoon ? (
            <Tag tone="accent">Due soon</Tag>
          ) : (
            <Tag tone={r.status === 'rejected' ? 'accent' : 'ink'}>{STATUS_LABELS[r.status]}</Tag>
          )}
          <MoreVertical size={18} className={dark ? 'text-white/70' : 'text-[var(--ink)]'} />
        </div>
        <p className={clsx('mt-3 truncate text-lg', dark ? 'text-white' : 'text-[var(--ink)]')}>{r.title}</p>
        <p className={clsx('mt-1 line-clamp-2 text-[15px] leading-snug', dark ? 'text-white/80' : 'text-[var(--ink-soft)]')}>
          {r.description || r.project?.name}
        </p>
        {r.requester && (
          <div className="mt-3 flex items-center gap-3">
            <Avatar initials={r.requester.avatar_initials} size={34} index={r.requester.full_name.length} />
            <div className="min-w-0">
              <p className="truncate text-sm">{r.requester.full_name}</p>
              <p className={clsx('truncate text-xs', dark ? 'text-white/50' : 'text-slate-500')}>{ROLE_LABELS[r.requester.role]}</p>
            </div>
          </div>
        )}
      </div>
      <div className={clsx('flex items-center justify-between border-t px-5 py-3.5 text-sm', dark ? 'border-white/10' : 'border-black/[0.06]')}>
        <span className="flex items-center gap-2">
          <CalendarDays size={16} strokeWidth={1.75} />
          {dueLabel(r.required_date)}
        </span>
        <span className="font-medium">{money(Number(r.approved_amount ?? r.estimated_amount ?? 0))}</span>
      </div>
    </Link>
  )
}

function Tag({ tone, children }: { tone: 'ink' | 'sun' | 'accent'; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        'rounded-full px-2.5 py-1 text-xs',
        tone === 'ink' && 'bg-[var(--ink)] text-white',
        tone === 'sun' && 'bg-[var(--sun)] text-[var(--ink)]',
        tone === 'accent' && 'bg-[var(--accent)] text-white',
      )}
    >
      {children}
    </span>
  )
}

function VolumeTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs text-[var(--ink)] shadow-[0_8px_24px_rgba(24,20,18,0.12)]">
      {[...payload].reverse().map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[p.name] }} />
          {p.name} - {p.value}
        </p>
      ))}
    </div>
  )
}
