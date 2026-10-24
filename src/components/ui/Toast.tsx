import toast, { type Toast as HotToast } from 'react-hot-toast'
import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react'

export type ToastLevel = 'success' | 'error' | 'warning' | 'info'

const LEVELS: Record<ToastLevel, { icon: LucideIcon; bg: string; border: string; tint: string; color: string; label: string }> = {
  success: { icon: CheckCircle2, bg: '#ecf7f1', border: '#bfe5d0', tint: '#d3efdf', color: '#1e8c66', label: 'Success' },
  error: { icon: XCircle, bg: '#fdeeea', border: '#f6c9bd', tint: '#fad9d0', color: '#d63a1f', label: 'Error' },
  warning: { icon: AlertTriangle, bg: '#fdf5dc', border: '#f1dc9a', tint: '#f9e8b3', color: '#b7791f', label: 'Warning' },
  info: { icon: Info, bg: '#f3f1ee', border: '#e2ddd6', tint: '#e6e1da', color: '#181412', label: 'Notice' },
}

export function Toast({ t, level, message }: { t: HotToast; level: ToastLevel; message: string }) {
  const s = LEVELS[level]
  const Icon = s.icon

  return (
    <div
      role={level === 'error' ? 'alert' : 'status'}
      className={clsx(
        'pointer-events-auto flex w-[min(24rem,calc(100vw-2rem))] items-center gap-3 rounded-2xl border p-3 font-[Onest,Inter,sans-serif] shadow-[0_12px_32px_-12px_rgba(24,20,18,0.28)]',
        t.visible ? 'toast-enter' : 'toast-leave',
      )}
      style={{ background: s.bg, borderColor: s.border }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: s.tint, color: s.color }}>
        <Icon size={18} strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: s.color }}>{s.label}</p>
        <p className="text-sm leading-snug font-medium text-[#181412]">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        aria-label="Dismiss"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#181412]/50 transition-colors hover:bg-black/5 hover:text-[#181412]"
      >
        <X size={16} strokeWidth={2.25} />
      </button>
    </div>
  )
}
