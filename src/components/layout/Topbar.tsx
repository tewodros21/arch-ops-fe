import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Search, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { notify } from '@/lib/notify'
import { createActionFor } from './nav'
import { NotificationsPanel } from './NotificationsPanel'

// On phones the menu and create action live in the bottom bar instead
export function Topbar() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  // A quiet heads-up when something new lands while the panel is closed
  const { items, unread, markRead, markAllRead, dismiss } = useNotifications(profile?.id, (n) => {
    if (!notifOpen) notify.info(n.title)
  })
  if (!profile) return null
  const create = createActionFor(pathname, profile.role)

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/requests?q=${encodeURIComponent(q)}` : '/requests')
  }

  return (
    <header className="sticky top-4 z-20 mb-5 flex items-center gap-2 sm:gap-3">
      <form
        onSubmit={handleSearch}
        className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full border border-[var(--card-border)] bg-white px-4 sm:h-14 sm:px-5 shadow-[0_1px_2px_rgba(24,20,18,0.03)]"
      >
        <Search size={20} strokeWidth={1.75} className="shrink-0 text-[var(--ink)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search requests, projects or request numbers…"
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-slate-400"
        />
        <Link to="/requests" title="Filters" className="focus-ring rounded-full p-1.5 text-[var(--ink-soft)] hover:bg-black/[0.04]">
          <SlidersHorizontal size={18} strokeWidth={1.75} />
        </Link>
      </form>

      <button
        onClick={() => setNotifOpen(true)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="focus-ring relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--card-border)] bg-white text-[var(--ink)] transition-colors hover:bg-[var(--canvas)] sm:h-14 sm:w-14"
      >
        <Bell size={20} strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-white ring-2 ring-[var(--canvas)]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <Link
        to={{ search: create.search }}
        aria-label={create.aria}
        className="focus-ring hidden h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--panel-dark)] px-6 text-sm font-semibold text-white transition-transform active:scale-[0.98] md:flex"
      >
        <create.icon size={18} />
        {create.label}
      </Link>
      {notifOpen && (
        <NotificationsPanel
          items={items}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onDismiss={dismiss}
          onClose={() => setNotifOpen(false)}
        />
      )}
    </header>
  )
}
