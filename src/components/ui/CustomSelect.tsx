import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  description?: string
  icon?: ReactNode
}

interface CustomSelectProps<T extends string = string> {
  id?: string
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  ariaLabel?: string
  className?: string
  buttonClassName?: string
  menuClassName?: string
  disabled?: boolean
}

export function CustomSelect<T extends string = string>({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  ariaLabel,
  className,
  buttonClassName,
  menuClassName,
  disabled = false,
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const selected = options.find((opt) => opt.value === value)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          'focus-ring flex w-full items-center justify-between gap-2 rounded-2xl border border-black/10 bg-[var(--canvas)] px-4 py-3 text-sm text-[var(--ink)] transition-colors hover:border-black/25 focus:border-[var(--ink)] focus:bg-white disabled:pointer-events-none disabled:opacity-50',
          open && 'border-[var(--ink)] bg-white ring-2 ring-[var(--ink)]/10',
          buttonClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-2 truncate">
          {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
          <span className={clsx('truncate', !selected && 'text-slate-400')}>
            {selected ? selected.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={clsx('shrink-0 text-slate-400 transition-transform duration-200', open && 'rotate-180 text-[var(--ink)]')}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          className={clsx(
            'absolute left-0 top-full z-50 mt-1.5 w-full min-w-[12rem] overflow-hidden rounded-2xl border border-black/10 bg-white p-1.5 shadow-[0_16px_36px_rgba(24,20,18,0.14)]',
            menuClassName,
          )}
        >
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {options.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={clsx(
                    'group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                    isSelected
                      ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
                      : 'text-[var(--ink)] hover:bg-[var(--canvas)]',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate">
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <span className="truncate">{option.label}</span>
                    </div>
                    {option.description && (
                      <p className="mt-0.5 text-xs text-slate-500 font-normal">
                        {option.description}
                      </p>
                    )}
                  </div>
                  {isSelected && <Check size={16} className="shrink-0 text-[var(--accent)]" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
