import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export interface Crumb {
  label: string
  to?: string
}

// Pill-style trail shown above detail pages: Overview › Purchase requests › PR-2026-0012
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 px-1 text-sm">
      {items.map((c, i) => {
        const last = i === items.length - 1
        return (
          <Fragment key={`${c.label}-${i}`}>
            {c.to && !last ? (
              <Link to={c.to} className="focus-ring rounded-full px-2 py-1 text-[var(--ink-soft)] transition-colors hover:bg-white hover:text-[var(--ink)]">
                {c.label}
              </Link>
            ) : (
              <span aria-current={last ? 'page' : undefined} className="truncate rounded-full bg-white px-3 py-1 font-medium text-[var(--ink)]">
                {c.label}
              </span>
            )}
            {!last && <ChevronRight size={14} className="shrink-0 text-slate-400" />}
          </Fragment>
        )
      })}
    </nav>
  )
}
