import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'

/** White card holding a list that reads as a table from md up, and as stacked rows on phones */
export function ListCard({ columns, template, children }: { columns: string[]; template: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] bg-white p-3 sm:p-4">
      <div className={clsx('hidden gap-4 px-3 pt-2 pb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase md:grid', template)}>
        {columns.map((c, i) => (
          <span key={`${c}-${i}`}>{c}</span>
        ))}
      </div>
      <ul className="space-y-1">{children}</ul>
    </section>
  )
}

export function EmptyCard({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[1.75rem] bg-white px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--canvas)] text-slate-400">
        <Icon size={24} />
      </span>
      <p className="text-lg font-bold text-[var(--ink)]">{title}</p>
      {body && <p className="text-sm text-slate-500">{body}</p>}
      {action}
    </div>
  )
}

export function ActivePill({ active }: { active: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        active ? 'bg-[#d3efdf] text-[#1e8c66]' : 'bg-[var(--canvas)] text-slate-500',
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', active ? 'bg-[#1e8c66]' : 'bg-slate-400')} />
      {active ? 'Active' : 'Archived'}
    </span>
  )
}
