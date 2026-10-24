import type { ReactNode } from 'react'

export function PageHeader({ title, count, subtitle, actions }: { title: string; count?: number; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-1">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[clamp(2rem,4vw,2.75rem)] leading-none font-black tracking-[-0.035em] text-[var(--ink)]">{title}</h1>
          {count !== undefined && (
            <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-white px-3 text-sm font-medium text-[var(--ink)]">
              {count}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-2 text-sm text-[var(--ink-soft)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
