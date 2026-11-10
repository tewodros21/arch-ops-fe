import { useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { money } from './metrics'

export type RangeOption = { value: number; label: string }

export function RangeSelect({ value, onChange, options, ariaLabel }: { value: number; onChange: (value: number) => void; options: RangeOption[]; ariaLabel: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
        className="flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs text-[var(--ink)] transition-colors hover:border-black/20 hover:bg-[var(--canvas)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      >
        {selected?.label}
        <ChevronDown size={14} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="menu" aria-label={ariaLabel} className="absolute right-0 top-full z-30 mt-2 min-w-40 overflow-hidden rounded-2xl border border-black/10 bg-white p-1.5 text-sm text-[var(--ink)] shadow-[0_12px_32px_rgba(24,20,18,0.16)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={value === option.value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
                triggerRef.current?.focus()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setOpen(false)
                  triggerRef.current?.focus()
                }
              }}
              className={clsx(
                'block w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--canvas)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                value === option.value && 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** White bento card with the dashboard's heading row */
export function ChartCard({ title, subtitle, action, className, children }: { title: string; subtitle: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={clsx('min-w-0 rounded-[1.75rem] bg-white p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-normal text-[var(--ink)]">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        {action}
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
