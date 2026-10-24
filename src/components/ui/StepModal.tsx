import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Check, X, type LucideIcon } from 'lucide-react'

const CLOSE_MS = 220

export interface Step {
  title: string
  hint: string
}

interface StepModalProps {
  title: string
  icon: LucideIcon
  steps: Step[]
  step: number
  /** Parent validates the current step and advances */
  onNext: () => void
  onBack: () => void
  onGoTo: (index: number) => void
  /** Receives an animated close for use after a successful submit */
  onSubmit: (close: () => void) => void
  submitLabel: string
  busy: boolean
  /** Unsaved input: closing asks to discard first */
  dirty: boolean
  /** Live summary shown at the bottom of the dark side panel */
  summary: ReactNode
  onClose: () => void
  children: ReactNode
  /** Optional outline button beside submit on the last step (e.g. "Save as draft") */
  secondaryAction?: { label: string; onClick: (close: () => void) => void; disabled?: boolean }
  /** Disables only the last-step submit button (e.g. a precondition is missing) */
  submitDisabled?: boolean
  /** Question shown before discarding unsaved input */
  discardPrompt?: string
}

// Shared shell for multi-step create flows: dark side panel with steps and a
// live summary, progress bar, discard confirmation, bottom sheet on mobile.
export function StepModal({ title, icon: Icon, steps, step, onNext, onBack, onGoTo, onSubmit, submitLabel, busy, dirty, summary, onClose, children, secondaryAction, submitDisabled, discardPrompt = 'Discard this request?' }: StepModalProps) {
  const [closing, setClosing] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const isLast = step === steps.length - 1
  const showSecondary = isLast && !!secondaryAction

  function close() {
    setClosing(true)
    window.setTimeout(onClose, CLOSE_MS)
  }

  function requestClose() {
    if (busy) return
    if (dirty && !confirmDiscard) setConfirmDiscard(true)
    else close()
  }

  // Lock page scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Focus the first field of each step
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
    bodyRef.current?.querySelector<HTMLElement>('input, select, textarea')?.focus()
  }, [step])

  return createPortal(
    <div className="app-shell fixed inset-0 z-50 flex items-end justify-center !bg-transparent sm:items-center sm:p-6">
      <div className={clsx('absolute inset-0 bg-[#181412]/55 backdrop-blur-[6px]', closing ? 'modal-fade-out' : 'modal-fade-in')} onClick={requestClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'relative flex h-[94svh] w-full max-w-5xl overflow-hidden rounded-t-[2rem] bg-white shadow-[0_40px_120px_-30px_rgba(24,20,18,0.6)] sm:h-[min(46rem,92svh)] sm:rounded-[2rem]',
          closing ? 'modal-pop-out' : 'modal-pop-in',
        )}
      >
        {/* ── Side panel ── */}
        <aside className="panel-dark relative hidden w-72 shrink-0 flex-col p-7 md:flex">
          <div className="relative">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
              <Icon size={20} />
            </span>
            <h2 className="mt-5 text-3xl leading-[0.95] font-black tracking-[-0.03em] text-white">{title}</h2>
          </div>

          <ol className="relative mt-8 space-y-1">
            {steps.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => onGoTo(i)}
                  className={clsx('focus-ring flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors', i === step ? 'bg-white/10' : 'hover:bg-white/5')}
                >
                  <span
                    className={clsx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      i < step && 'bg-[var(--sun)] text-[var(--ink)]',
                      i === step && 'bg-white text-[var(--ink)]',
                      i > step && 'border border-white/25 text-white/50',
                    )}
                  >
                    {i < step ? <Check size={14} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={clsx('block text-sm', i === step ? 'text-white' : 'text-white/60')}>{s.title}</span>
                    <span className="block truncate text-[11px] text-white/35">{s.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className="relative mt-auto space-y-3 rounded-2xl bg-white/[0.06] p-4">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/45 uppercase">Summary</p>
            {summary}
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-7">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
                Step {step + 1} of {steps.length}
              </p>
              <h3 className="mt-1 text-2xl font-bold text-[var(--ink)]">{steps[step].title}</h3>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 text-[var(--ink)] transition-colors hover:bg-[var(--canvas)]"
            >
              <X size={18} />
            </button>
          </header>

          <div className="mx-6 mt-4 flex gap-1.5 sm:mx-8">
            {steps.map((s, i) => (
              <span key={s.title} className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--cell)]">
                <span className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: i <= step ? '100%' : '0%' }} />
              </span>
            ))}
          </div>

          <div ref={bodyRef} onInput={() => setConfirmDiscard(false)} className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
            <div key={step} className="step-in space-y-5">
              {children}
            </div>
          </div>

          <footer className={clsx('flex items-center justify-between gap-3 border-t border-black/[0.06] px-6 py-4 sm:px-8', showSecondary && 'flex-wrap sm:flex-nowrap')}>
            {confirmDiscard ? (
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--ink)]">{discardPrompt}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDiscard(false)}
                    className="focus-ring h-11 rounded-full border border-black/15 px-5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--canvas)]"
                  >
                    Keep editing
                  </button>
                  <button type="button" autoFocus onClick={close} className="focus-ring h-11 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white">
                    Discard
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => (step === 0 ? requestClose() : onBack())}
                  disabled={busy}
                  className="focus-ring inline-flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--canvas)] disabled:opacity-50"
                >
                  {step === 0 ? (
                    'Cancel'
                  ) : (
                    <>
                      <ArrowLeft size={16} /> Back
                    </>
                  )}
                </button>
                <div className={clsx('flex min-w-0 items-center gap-2', showSecondary && 'w-full sm:w-auto')}>
                  {showSecondary && (
                    <button
                      type="button"
                      onClick={() => secondaryAction?.onClick(close)}
                      disabled={busy || secondaryAction?.disabled}
                      className="focus-ring inline-flex h-12 flex-1 items-center justify-center rounded-full border border-black/15 px-5 text-sm font-medium whitespace-nowrap text-[var(--ink)] transition-colors hover:bg-[var(--canvas)] disabled:opacity-50 sm:flex-none"
                    >
                      {secondaryAction?.label}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (isLast ? onSubmit(close) : onNext())}
                    disabled={busy || (isLast && submitDisabled)}
                    className={clsx(
                      'focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-60',
                      isLast ? 'cta-pill text-[var(--ink)]' : 'bg-[var(--ink)] text-white',
                      showSecondary && 'flex-1 px-5 sm:flex-none sm:px-7',
                    )}
                  >
                    {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                    {isLast ? submitLabel : 'Continue'}
                    {!busy && <ArrowRight size={16} className="shrink-0" />}
                  </button>
                </div>
              </>
            )}
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Field label row shared by step modal forms
export function StepField({ label, optional, error, children }: { label: string; optional?: boolean; error?: boolean; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className={clsx('text-sm font-medium', error ? 'text-[var(--accent)]' : 'text-[var(--ink)]')}>{label}</label>
        {optional && <span className="text-xs text-slate-400">Optional</span>}
        {error && <span className="text-xs font-medium text-[var(--accent)]">Required</span>}
      </div>
      {children}
    </div>
  )
}

// Clickable card used on review steps to jump back and edit
export function ReviewTile({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <button type="button" onClick={onEdit} className="focus-ring group rounded-[1.5rem] border border-black/10 p-4 text-left transition-colors hover:border-black/30">
      <span className="flex items-center justify-between text-xs text-slate-500">
        {label}
        <span className="opacity-0 transition-opacity group-hover:opacity-100">Edit</span>
      </span>
      <span className="mt-1 block truncate text-sm font-semibold text-[var(--ink)]">{value}</span>
    </button>
  )
}
