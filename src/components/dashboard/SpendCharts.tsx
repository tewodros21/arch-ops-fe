import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, isSameMonth, startOfMonth, subMonths } from 'date-fns'
import type { PurchaseRequest, RequestStatus } from '@/types'
import { ChartCard, EmptyChart, Legend, MoneyTooltip, RangeSelect } from './kit'
import { approvedValue, AXIS_TICK, COLORS, compactMoney, DONE, IN_REVIEW, money, PAID, paidValue } from './metrics'

const SPEND_SERIES = [
  { key: 'approved', name: 'Approved', color: COLORS.accent },
  { key: 'paid', name: 'Paid', color: COLORS.ink },
] as const

const STATUS_GROUPS: { label: string; statuses: RequestStatus[]; color: string; to: string }[] = [
  { label: 'New', statuses: ['draft', 'proforma_received'], color: COLORS.tan, to: '/requests' },
  { label: 'In review', statuses: IN_REVIEW, color: COLORS.sun, to: '/requests?status=review' },
  { label: 'Approved', statuses: ['approved'], color: COLORS.accent, to: '/requests?status=approved' },
  { label: 'Purchased & done', statuses: PAID, color: COLORS.ink, to: '/requests?status=done' },
  { label: 'Rejected', statuses: ['rejected'], color: COLORS.stone, to: '/requests?status=rejected' },
]

const TOP_N = 5
const TREND_OPTIONS = [
  { value: 3, label: 'Last 3 months' },
  { value: 6, label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
  { value: 24, label: 'Last 24 months' },
]

type SpendRow = { name: string; fullName: string; approved: number; paid: number }

function shorten(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function spendBy(requests: PurchaseRequest[], keyOf: (r: PurchaseRequest) => string, max: number): SpendRow[] {
  const rows = new Map<string, SpendRow>()
  for (const r of requests) {
    if (!DONE.includes(r.status)) continue
    const key = keyOf(r)
    const row = rows.get(key) ?? { name: shorten(key, max), fullName: key, approved: 0, paid: 0 }
    row.approved += approvedValue(r)
    row.paid += paidValue(r)
    rows.set(key, row)
  }
  return [...rows.values()].sort((a, b) => b.approved - a.approved).slice(0, TOP_N)
}

/** Multi-project requests split their value across projects by each project's share of the items */
function spendByProject(requests: PurchaseRequest[]): SpendRow[] {
  const rows = new Map<string, SpendRow>()
  for (const r of requests) {
    if (!DONE.includes(r.status)) continue
    const names = new Map((r.projects ?? (r.project ? [r.project] : [])).map((p) => [p.id, p.name]))
    const shares = r.project_shares && Object.keys(r.project_shares).length ? r.project_shares : { [r.project_id]: 1 }
    for (const [id, share] of Object.entries(shares)) {
      const key = names.get(id) ?? r.project?.name ?? 'No project'
      const row = rows.get(key) ?? { name: shorten(key, 16), fullName: key, approved: 0, paid: 0 }
      row.approved += approvedValue(r) * share
      row.paid += paidValue(r) * share
      rows.set(key, row)
    }
  }
  return [...rows.values()].sort((a, b) => b.approved - a.approved).slice(0, TOP_N)
}

export function SpendCharts({ scoped, loading }: { scoped: PurchaseRequest[]; loading: boolean }) {
  const [trendMonths, setTrendMonths] = useState(6)
  const byProject = spendByProject(scoped)
  const byDepartment = spendBy(scoped, (r) => r.department?.trim() || 'Unassigned', 12)

  // ── Monthly trend: approved value by month raised, paid value by month purchased ──
  const thisMonth = startOfMonth(new Date())
  const months = Array.from({ length: trendMonths }, (_, i) => subMonths(thisMonth, trendMonths - 1 - i))
  const trend = months.map((m) => ({
    month: format(m, 'MMM'),
    fullName: format(m, 'MMMM yyyy'),
    approved: scoped.filter((r) => !!r.created_at && isSameMonth(new Date(r.created_at), m)).reduce((s, r) => s + approvedValue(r), 0),
    paid: scoped.filter((r) => {
      const updatedAt = r.updated_at ?? r.created_at
      return !!updatedAt && isSameMonth(new Date(updatedAt), m)
    }).reduce((s, r) => s + paidValue(r), 0),
  }))
  const trendApproved = trend.reduce((s, t) => s + t.approved, 0)
  const trendPaid = trend.reduce((s, t) => s + t.paid, 0)

  // ── Requests by status group ──
  const groups = STATUS_GROUPS.map((g) => ({ ...g, count: scoped.filter((r) => g.statuses.includes(r.status)).length }))
  const total = groups.reduce((s, g) => s + g.count, 0)

  const topProject = byProject[0]

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Spend by project */}
      <ChartCard
        title="Spend by project"
        subtitle={topProject ? `${topProject.fullName} leads with ${money(topProject.approved)} approved` : 'Top projects by approved value'}
      >
        <Legend items={[...SPEND_SERIES]} shape="bar" />
        <div className="mt-2 h-56">
          {!loading && byProject.length === 0 ? (
            <EmptyChart>No approved spend yet</EmptyChart>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProject} layout="vertical" barGap={3} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(24,20,18,0.08)" horizontal={false} />
                <XAxis type="number" tickFormatter={compactMoney} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={104} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(24,20,18,0.04)' }} />
                {SPEND_SERIES.map((sr) => (
                  <Bar key={sr.key} dataKey={sr.key} name={sr.name} fill={sr.color} barSize={9} radius={[0, 6, 6, 0]} animationDuration={700} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      {/* Spend by department */}
      <ChartCard
        title="Spend by department"
        subtitle={`${money(byDepartment.reduce((s, d) => s + d.paid, 0))} paid of ${money(byDepartment.reduce((s, d) => s + d.approved, 0))} approved`}
      >
        <Legend items={[...SPEND_SERIES]} shape="bar" />
        <div className="mt-2 h-56">
          {!loading && byDepartment.length === 0 ? (
            <EmptyChart>No approved spend yet</EmptyChart>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDepartment} barGap={3} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(24,20,18,0.08)" vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={6} />
                <YAxis tickFormatter={compactMoney} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(24,20,18,0.04)' }} />
                {SPEND_SERIES.map((sr) => (
                  <Bar key={sr.key} dataKey={sr.key} name={sr.name} fill={sr.color} maxBarSize={16} radius={[6, 6, 0, 0]} animationDuration={700} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      {/* Requests by status */}
      <ChartCard title="Requests by status" subtitle={`${total} request${total === 1 ? '' : 's'} in total`}>
        <div className="mt-4 grid grid-cols-1 items-center gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <div className="relative mx-auto h-44 w-44" role="img" aria-label={`Requests by status: ${groups.map((g) => `${g.label} ${g.count}`).join(', ')}`}>
          {total === 0 ? (
            <div className="h-full w-full rounded-full border-[18px] border-[var(--cell)]" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={groups.filter((g) => g.count > 0)}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="#fff"
                  strokeWidth={2}
                  animationDuration={700}
                >
                  {groups.filter((g) => g.count > 0).map((g) => (
                    <Cell key={g.label} fill={g.color} />
                  ))}
                </Pie>
                <Tooltip content={<StatusTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-[var(--ink)]">{total}</span>
            <span className="text-xs text-slate-500">requests</span>
          </div>
        </div>
        <ul className="divide-y divide-black/[0.06]">
          {groups.map((g) => (
            <li key={g.label}>
              <Link to={g.to} className="focus-ring group flex items-center gap-3 rounded-lg py-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)] group-hover:text-[var(--accent)]">{g.label}</span>
                <span className="text-xs text-slate-500">{total ? Math.round((g.count / total) * 100) : 0}%</span>
                <span className="w-8 text-right text-lg font-bold text-[var(--ink)]">{g.count}</span>
              </Link>
            </li>
          ))}
        </ul>
        </div>
      </ChartCard>

      {/* Monthly purchasing trend */}
      <ChartCard
        title="Purchasing trend"
        subtitle={`${money(trendApproved)} approved · ${money(trendPaid)} paid`}
        action={<RangeSelect value={trendMonths} onChange={setTrendMonths} options={TREND_OPTIONS} ariaLabel="Purchasing trend time range" />}
      >
        <Legend items={[...SPEND_SERIES]} />
        <div className="mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            {/* Remount once data arrives so the lines draw in on real values */}
            <LineChart key={loading ? 'loading' : 'ready'} data={trend} className="chart-draw" margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(24,20,18,0.08)" horizontal={false} />
              <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compactMoney} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<MoneyTooltip />} cursor={{ stroke: COLORS.ink, strokeOpacity: 0.3, strokeDasharray: '4 4' }} />
              {SPEND_SERIES.map((sr, i) => (
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
                  isAnimationActive={false}
                  pathLength={1}
                  style={{ animationDelay: `${i * 140}ms` }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  )
}

function StatusTooltip({ active, payload, total }: { active?: boolean; payload?: { name: string; value: number; payload: { color: string } }[]; total: number }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs text-[var(--ink)] shadow-[0_8px_24px_rgba(24,20,18,0.12)]">
      <p className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: entry.payload.color }} />
        {entry.name} - {entry.value} ({total ? Math.round((entry.value / total) * 100) : 0}%)
      </p>
    </div>
  )
}
