import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { isSameMonth } from 'date-fns'
import { AlarmClock, BadgeCheck, HardHat, Hourglass, Inbox, ShoppingBag, type LucideIcon } from 'lucide-react'
import { STATUS_LABELS, type LaborRequest, type Profile, type PurchaseRequest, type RequestStatus } from '@/types'
import { approvedValue, compactMoney, DONE, IN_REVIEW, isOverdue, isStuck, money, PAID, STUCK_HOURS } from './metrics'

const AWAITING_BY_ROLE: Record<string, RequestStatus | null> = {
  employee: null,
  finance: 'awaiting_finance',
  general_manager: 'awaiting_gm',
  owner: 'awaiting_owner',
  admin: null,
}

// Full dollars read best, but big totals get the short form so tiles never overflow on phones
function kpiMoney(n: number) {
  return n >= 100_000 ? compactMoney(n) : money(n)
}

interface Kpi {
  label: string
  value: string | number
  sub: string
  to: string
  icon: LucideIcon
  tone?: 'dark' | 'alert'
  title?: string
}

export function KpiCards({
  profile,
  requests,
  scoped,
  labor,
  loading,
}: {
  profile: Profile
  requests: PurchaseRequest[]
  scoped: PurchaseRequest[]
  labor: LaborRequest[]
  loading: boolean
}) {
  const now = new Date()
  const pending = scoped.filter((r) => IN_REVIEW.includes(r.status))
  const pendingValue = pending.reduce((s, r) => s + Number(r.estimated_amount ?? 0), 0)

  // The role's own stage, or a sensible stand-in for roles that don't approve
  const awaitingStatus = AWAITING_BY_ROLE[profile.role]
  let mine: Kpi
  if (awaitingStatus) {
    const items = requests.filter((r) => r.status === awaitingStatus)
    const stuck = items.filter((r) => isStuck(r, now)).length
    mine = {
      label: 'Awaiting my action',
      value: items.length,
      sub: stuck ? `${stuck} waiting over ${STUCK_HOURS}h` : `${STATUS_LABELS[awaitingStatus]}`,
      to: `/requests?status=${awaitingStatus}`,
      icon: Inbox,
      tone: 'dark',
    }
  } else if (profile.role === 'admin') {
    const items = requests.filter((r) => r.status === 'approved')
    mine = {
      label: 'Ready to purchase',
      value: items.length,
      sub: `${money(items.reduce((s, r) => s + approvedValue(r), 0))} approved`,
      to: '/requests?status=approved',
      icon: ShoppingBag,
      tone: 'dark',
    }
  } else {
    const items = scoped.filter((r) => !DONE.includes(r.status) && r.status !== 'rejected')
    mine = {
      label: 'My open requests',
      value: items.length,
      sub: `${items.filter((r) => IN_REVIEW.includes(r.status)).length} with approvers`,
      to: '/requests',
      icon: Inbox,
      tone: 'dark',
    }
  }

  const purchasedThisMonth = scoped.filter((r) => PAID.includes(r.status) && isSameMonth(new Date(r.updated_at ?? r.created_at), now))
  const purchasedValue = purchasedThisMonth.reduce((s, r) => s + Number(r.actual_amount ?? r.approved_amount ?? r.estimated_amount ?? 0), 0)

  const approved = scoped.filter((r) => DONE.includes(r.status))
  const approvedTotal = approved.reduce((s, r) => s + approvedValue(r), 0)

  const myLabor = profile.role === 'employee' ? labor.filter((l) => l.requested_by === profile.id) : labor
  const activeLabor = myLabor.filter((l) => !['completed', 'cancelled'].includes(l.status))
  const workers = activeLabor.reduce((s, l) => s + Number(l.workers_required ?? 0), 0)

  const overdue = scoped.filter((r) => r.status !== 'rejected' && isOverdue(r))
  const stuck = scoped.filter((r) => isStuck(r, now) && !isOverdue(r))
  const delayed = overdue.length + stuck.length

  const kpis: Kpi[] = [
    mine,
    {
      label: 'Pending approvals',
      value: pending.length,
      sub: `${money(pendingValue)} in review`,
      to: '/requests?status=review',
      icon: Hourglass,
    },
    {
      label: 'Purchases this month',
      value: purchasedThisMonth.length,
      sub: `${money(purchasedValue)} spent`,
      to: '/requests?status=done',
      icon: ShoppingBag,
    },
    {
      label: 'Total approved',
      value: kpiMoney(approvedTotal),
      title: money(approvedTotal),
      sub: `Across ${approved.length} request${approved.length === 1 ? '' : 's'}`,
      to: '/requests?status=approved',
      icon: BadgeCheck,
    },
    {
      label: 'Active labor',
      value: activeLabor.length,
      sub: `${workers} worker${workers === 1 ? '' : 's'} requested`,
      to: '/labor',
      icon: HardHat,
    },
    {
      label: 'Delayed',
      value: delayed,
      sub: delayed ? `${overdue.length} overdue · ${stuck.length} stuck ${STUCK_HOURS}h+` : 'Nothing slipping',
      to: '/requests',
      icon: AlarmClock,
      tone: delayed ? 'alert' : undefined,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((k) => (
        <KpiCard key={k.label} kpi={k} loading={loading} />
      ))}
    </div>
  )
}

function KpiCard({ kpi: k, loading }: { kpi: Kpi; loading: boolean }) {
  const dark = k.tone === 'dark'
  const Icon = k.icon
  return (
    <Link
      to={k.to}
      className={clsx(
        'focus-ring group relative flex min-w-0 flex-col overflow-hidden rounded-[1.75rem] p-5 transition-transform hover:-translate-y-0.5',
        dark ? 'panel-dark text-white' : 'bg-white text-[var(--ink)]',
      )}
    >
      <div className="relative flex items-start justify-between gap-2">
        <p className={clsx('text-sm leading-tight', dark ? 'text-white/70' : 'text-[var(--ink-soft)]')}>{k.label}</p>
        <IconDot tone={k.tone}>
          <Icon size={16} />
        </IconDot>
      </div>
      <p
        title={k.title}
        className={clsx(
          'relative mt-4 truncate text-[2rem] leading-none font-black tracking-tight sm:text-[2.5rem]',
          k.tone === 'alert' && 'text-[var(--accent)]',
        )}
      >
        {loading ? '–' : k.value}
      </p>
      <p className={clsx('relative mt-2 truncate text-xs', dark ? 'text-white/50' : 'text-slate-500')}>{loading ? 'Loading…' : k.sub}</p>
    </Link>
  )
}

function IconDot({ tone, children }: { tone?: Kpi['tone']; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        tone === 'dark' && 'bg-[var(--sun)] text-[var(--ink)]',
        tone === 'alert' && 'bg-[var(--accent-soft)] text-[var(--accent)]',
        !tone && 'bg-[var(--canvas)] text-[var(--ink)]',
      )}
    >
      {children}
    </span>
  )
}
