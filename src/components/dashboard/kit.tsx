import type { ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { money } from './metrics'

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs text-[var(--ink)]">
      {children}
      <ChevronDown size={14} />
    </span>
  )
}

/** White bento card with the dashboard's heading row */
export function ChartCard({ title, subtitle, pill, className, children }: { title: string; subtitle: ReactNode; pill?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={clsx('min-w-0 rounded-[1.75rem] bg-white p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-normal text-[var(--ink)]">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        {pill && <Pill>{pill}</Pill>}
      </div>
      {children}
    </section>
  )
}

export function Legend({ items, shape = 'line' }: { items: { name: string; color: string }[]; shape?: 'line' | 'bar' }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((it) => (
        <span key={it.name} className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)]">
          <span className={clsx('w-3.5 rounded-full', shape === 'line' ? 'h-0.5' : 'h-2')} style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  )
}

export function EmptyChart({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-400">{children}</div>
}

type TooltipEntry = { name: string; value: number; color?: string; payload?: { fullName?: string } }

export function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number }) {
  if (!active || !payload?.length) return null
  const heading = payload[0]?.payload?.fullName ?? label
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs text-[var(--ink)] shadow-[0_8px_24px_rgba(24,20,18,0.12)]">
      {heading != null && <p className="mb-1 font-medium">{heading}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name} - {money(Number(p.value))}
        </p>
      ))}
    </div>
  )
}
