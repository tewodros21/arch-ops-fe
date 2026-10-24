import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { AlertTriangle, Check, X, type LucideIcon } from 'lucide-react'

const CLOSE_MS = 200

interface ConfirmOptions {
  title: string
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** danger = red (reject, delete), accent = yellow CTA (approve), ink = neutral */
  tone?: 'danger' | 'accent' | 'ink'
  icon?: LucideIcon
}

interface InputOptions extends ConfirmOptions {
  /** Shows a textarea; the dialog resolves to its text */
  input: { label: string; placeholder?: string; required?: boolean; initial?: string }
}

interface ConfirmFn {
  (options: ConfirmOptions): Promise<boolean>
  (options: InputOptions): Promise<string | null>
}

type Pending = { options: ConfirmOptions | InputOptions; resolve: (v: boolean | string | null) => void }

const ConfirmContext = createContext<ConfirmFn | null>(null)

// Promise-based confirmation modal: `if (await confirm({ title: 'Approve?' })) …`
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions | InputOptions) => new Promise((resolve) => setPending({ options, resolve: resolve as Pending['resolve'] })),
    [],
  ) as ConfirmFn

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog
          key={pending.options.title}
          options={pending.options}
          onDone={(value) => {
            pending.resolve(value)
            setPending(null)
          }}
        />
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}

function ConfirmDialog({ options, onDone }: { options: ConfirmOptions | InputOptions; onDone: (v: boolean | string | null) => void }) {
  const input = 'input' in options ? options.input : null
  const [value, setValue] = useState(input?.initial ?? '')
  const [closing, setClosing] = useState(false)
  const [touched, setTouched] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const tone = options.tone ?? 'ink'
  const Icon = options.icon ?? (tone === 'danger' ? AlertTriangle : Check)
  const invalid = !!input?.required && !value.trim()

  function finish(result: boolean) {
    if (result && invalid) {
      setTouched(true)
      return
    }
    setClosing(true)
    window.setTimeout(() => onDone(input ? (result ? value.trim() : null) : result), CLOSE_MS)
  }

  useEffect(() => {
    if (!input) confirmRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return createPortal(
    <div className="app-shell fixed inset-0 z-[60] flex items-end justify-center !bg-transparent p-3 sm:items-center sm:p-6">
      <div className={clsx('absolute inset-0 bg-[#181412]/55 backdrop-blur-[6px]', closing ? 'modal-fade-out' : 'modal-fade-in')} onClick={() => finish(false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={options.title}
        className={clsx(
          'relative w-full max-w-md rounded-[2rem] bg-white p-6 shadow-[0_40px_120px_-30px_rgba(24,20,18,0.6)] sm:p-7',
          closing ? 'modal-pop-out' : 'modal-pop-in',
        )}
      >
        <button
          type="button"
          onClick={() => finish(false)}
          aria-label="Close"
          className="focus-ring absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-[var(--ink)] hover:bg-[var(--canvas)]"
        >
          <X size={16} />
        </button>
        <span
          className={clsx(
            'flex h-12 w-12 items-center justify-center rounded-2xl',
            tone === 'danger' && 'bg-[var(--accent-soft)] text-[var(--accent)]',
            tone === 'accent' && 'bg-[var(--sun)] text-[var(--ink)]',
            tone === 'ink' && 'bg-[var(--ink)] text-white',
          )}
        >
          <Icon size={20} strokeWidth={2.25} />
        </span>
        <h2 className="mt-5 pr-8 text-2xl leading-tight font-black tracking-[-0.02em] text-[var(--ink)]">{options.title}</h2>
        {options.body && <div className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{options.body}</div>}

        {input && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="confirm-input" className={clsx('text-sm font-medium', touched && invalid ? 'text-[var(--accent)]' : 'text-[var(--ink)]')}>
                {input.label}
              </label>
              {input.required ? (
                touched && invalid && <span className="text-xs font-medium text-[var(--accent)]">Required</span>
              ) : (
                <span className="text-xs text-slate-400">Optional</span>
              )}
            </div>
            <textarea
              id="confirm-input"
              autoFocus
              rows={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={input.placeholder}
              className={clsx('field resize-none', touched && invalid && '!border-[var(--accent)]')}
            />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => finish(false)}
            className="focus-ring h-12 rounded-full border border-black/15 px-5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--canvas)]"
          >
            {options.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => finish(true)}
            className={clsx(
              'focus-ring h-12 rounded-full px-6 text-sm font-semibold transition-transform active:scale-[0.98]',
              tone === 'danger' && 'bg-[var(--accent)] text-white',
              tone === 'accent' && 'cta-pill text-[var(--ink)]',
              tone === 'ink' && 'bg-[var(--ink)] text-white',
            )}
          >
            {options.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
