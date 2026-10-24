import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { formatDistanceToNowStrict, isToday } from 'date-fns'
import { AlarmClock, BellOff, Check, CheckCheck, ClipboardCheck, HardHat, MessageSquare, ShoppingBag, Sparkles, Undo2, X, XCircle, type LucideIcon } from 'lucide-react'
import type { AppNotification, NotificationKind } from '@/types'

const KINDS: Record<NotificationKind, { icon: LucideIcon; bg: string; fg: string }> = {
  review: { icon: ClipboardCheck, bg: 'var(--sun)', fg: 'var(--ink)' },
  approved: { icon: Check, bg: '#d3efdf', fg: '#1e8c66' },
  rejected: { icon: XCircle, bg: 'var(--accent-soft)', fg: 'var(--accent)' },
  returned: { icon: Undo2, bg: 'var(--sun-soft)', fg: 'var(--ink)' },
  purchased: { icon: ShoppingBag, bg: '#e6e1da', fg: 'var(--ink)' },
  reminder: { icon: AlarmClock, bg: 'var(--accent)', fg: '#fff' },
  comment: { icon: MessageSquare, bg: '#e6e1da', fg: 'var(--ink)' },
  labor: { icon: HardHat, bg: 'var(--ink)', fg: '#fff' },
  system: { icon: Sparkles, bg: 'var(--canvas)', fg: 'var(--ink)' },
}

const CLOSE_MS = 240
const LEAVE_MS = 260

interface Props {
  items: AppNotification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onDismiss: (ids: string[]) => void
  onClose: () => void
}

export function NotificationsPanel({ items, onMarkRead, onMarkAllRead, onDismiss, onClose }: Props) {
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [leaving, setLeaving] = useState<Set<string>>(new Set())

  function close() {
    setClosing(true)
    window.setTimeout(onClose, CLOSE_MS)
  }

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Animate out, then drop from the list
  function dismiss(ids: string[]) {
    setLeaving((s) => new Set([...s, ...ids]))
    window.setTimeout(() => {
      onDismiss(ids)
      setLeaving((s) => new Set([...s].filter((id) => !ids.includes(id))))
    }, LEAVE_MS)
  }

  function open(n: AppNotification) {
    if (!n.is_read) onMarkRead(n.id)
    navigate(n.link || '/dashboard')
    close()
  }

  const unread = items.filter((n) => !n.is_read).length
  const visible = tab === 'unread' ? items.filter((n) => !n.is_read) : items
  const groups = [
    { label: 'Today', list: visible.filter((n) => isToday(new Date(n.created_at))) },
    { label: 'Earlier', list: visible.filter((n) => !isToday(new Date(n.created_at))) },
  ].filter((g) => g.list.length)

  return createPortal(
    <div className="app-shell fixed inset-0 z-50 !bg-transparent">
      <div className={clsx('absolute inset-0 bg-[#181412]/45 backdrop-blur-[4px]', closing ? 'modal-fade-out' : 'modal-fade-in')} onClick={close} />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className={clsx(
          'absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-[0_0_80px_-20px_rgba(24,20,18,0.5)] sm:inset-y-3 sm:right-3 sm:rounded-[2rem]',
          closing ? 'panel-out' : 'panel-in',
        )}
      >
        {/* Header */}
        <header className="shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black tracking-[-0.03em] text-[var(--ink)]">Notifications</h2>
              {unread > 0 && (
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--accent)] px-2 text-xs font-bold text-white">{unread}</span>
              )}
            </div>
            <button
              onClick={close}
              aria-label="Close notifications"
              className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 text-[var(--ink)] hover:bg-[var(--canvas)]"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              <button className="chip focus-ring !px-3.5 !py-1.5" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>
                All <span className="text-xs opacity-60">{items.length}</span>
              </button>
              <button className="chip focus-ring !px-3.5 !py-1.5" aria-pressed={tab === 'unread'} onClick={() => setTab('unread')}>
                Unread <span className="text-xs opacity-60">{unread}</span>
              </button>
            </div>
            <button
              onClick={onMarkAllRead}
              disabled={unread === 0}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--canvas)] disabled:opacity-40"
            >
              <CheckCheck size={15} />
              Mark all read
            </button>
          </div>
        </header>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {groups.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--canvas)] text-slate-400">
                <BellOff size={26} />
              </span>
              <p className="text-xl font-bold text-[var(--ink)]">You're all caught up</p>
              <p className="text-sm text-slate-500">{tab === 'unread' ? 'No unread notifications.' : 'New activity will show up here.'}</p>
            </div>
          )}

          {groups.map((g) => (
            <section key={g.label} className="mb-2">
              <p className="px-3 pt-2 pb-2 text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">{g.label}</p>
              <ul className="space-y-1">
                {g.list.map((n) => {
                  const k = KINDS[n.kind] ?? KINDS.system
                  return (
                    <li key={n.id} className={clsx('notif-row', leaving.has(n.id) && 'notif-leave')}>
                      <div
                        className={clsx(
                          'group relative flex gap-3 rounded-2xl p-3 transition-colors',
                          n.is_read ? 'hover:bg-[var(--canvas)]' : 'bg-[var(--canvas)]/70 hover:bg-[var(--canvas)]',
                        )}
                      >
                        <button onClick={() => open(n)} className="focus-ring absolute inset-0 rounded-2xl" aria-label={`Open: ${n.title}`} />
                        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: k.bg, color: k.fg }}>
                          <k.icon size={18} strokeWidth={2.25} />
                        </span>
                        <div className="pointer-events-none relative min-w-0 flex-1 pr-6">
                          <p className={clsx('text-sm leading-snug text-[var(--ink)]', n.is_read ? 'font-medium' : 'font-bold')}>{n.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--ink-soft)]">{n.body}</p>
                          <p className="mt-1.5 text-[11px] text-slate-400">{formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}</p>
                        </div>
                        {!n.is_read && <span className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-[var(--accent)] transition-opacity group-hover:opacity-0" />}
                        <button
                          onClick={() => dismiss([n.id])}
                          aria-label="Dismiss notification"
                          className="focus-ring absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-[var(--ink)] focus-visible:opacity-100"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-black/[0.06] px-6 py-4">
            <p className="text-xs text-slate-400">Updates arrive live</p>
            <button
              onClick={() => dismiss(visible.map((n) => n.id))}
              className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              Clear {tab === 'unread' ? 'unread' : 'all'}
            </button>
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  )
}
