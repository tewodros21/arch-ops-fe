import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { X, type LucideIcon } from 'lucide-react'

const CLOSE_MS = 200

interface FormModalProps {
  title: string
  description?: ReactNode
  icon: LucideIcon
  submitLabel?: string
  /** Return false to keep the modal open (validation or save failed) */
  onSubmit: () => Promise<boolean | void> | boolean | void
  onClose: () => void
  children: ReactNode
}

// Centered create/edit form, same shell as the confirm dialog (bottom sheet on phones)
export function FormModal({ title, description, icon: Icon, submitLabel = 'Save', onSubmit, onClose, children }: FormModalProps) {
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  function close() {
    if (busy) return
    setClosing(true)
    window.setTimeout(onClose, CLOSE_MS)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const ok = await onSubmit()
    setBusy(false)
    if (ok !== false) {
      setClosing(true)
      window.setTimeout(onClose, CLOSE_MS)
    }
  }

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    bodyRef.current?.querySelector<HTMLElement>('input:not([type=checkbox]), select, textarea')?.focus()
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return createPortal(
    <div className="app-shell fixed inset-0 z-[55] flex items-end justify-center !bg-transparent p-3 sm:items-center sm:p-6">
      <div className={clsx('absolute inset-0 bg-[#181412]/55 backdrop-blur-[6px]', closing ? 'modal-fade-out' : 'modal-fade-in')} onClick={close} />
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={handleSubmit}
        noValidate
        className={clsx(
          'relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col rounded-[2rem] bg-white shadow-[0_40px_120px_-30px_rgba(24,20,18,0.6)] sm:max-h-[calc(100dvh-3rem)]',
          closing ? 'modal-pop-out' : 'modal-pop-in',
        )}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="focus-ring absolute top-5 right-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--ink)] hover:bg-[var(--canvas)]"
        >
          <X size={16} />
        </button>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-7">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ink)] text-white">
            <Icon size={20} strokeWidth={2.25} />
          </span>
          <h2 className="mt-5 pr-8 text-2xl leading-tight font-black tracking-[-0.02em] text-[var(--ink)]">{title}</h2>
          {description && <div className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{description}</div>}
          <div className="mt-6 space-y-4">{children}</div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-black/[0.06] px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
          <button
            type="button"
            onClick={close}
            className="focus-ring h-12 rounded-full border border-black/15 px-5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--canvas)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

/** Label + control row used inside FormModal */
export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string | null; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className={clsx('text-sm font-medium', error ? 'text-[var(--accent)]' : 'text-[var(--ink)]')}>
          {label}
        </label>
        {error ? <span className="text-xs font-medium text-[var(--accent)]">{error}</span> : hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

/** Pill switch for boolean settings like "Active" */
export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-ring flex w-full items-center justify-between gap-4 rounded-2xl bg-[var(--canvas)] px-4 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--ink)]">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </span>
      <span className={clsx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-[var(--ink)]' : 'bg-black/15')}>
        <span className={clsx('absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </span>
    </button>
  )
}
