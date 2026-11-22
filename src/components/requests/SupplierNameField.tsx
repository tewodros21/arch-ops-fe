import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { fetchSupplierSuggestions } from '@/services/requests'
import type { SupplierSuggestion } from '@/types'

// Matches the input styling used throughout NewRequestModal
const inputClass =
  'focus-ring w-full rounded-2xl border bg-[var(--canvas)] px-4 py-3 text-sm text-[var(--ink)] placeholder:text-slate-400 transition-colors focus:border-[var(--ink)] focus:bg-white'

// Same debounce the modal uses for duplicate checks
const DEBOUNCE_MS = 350
const MIN_QUERY = 2

interface Props {
  id?: string
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: SupplierSuggestion) => void
  placeholder?: string
  'aria-label'?: string
}

/**
 * Supplier name input with autocomplete over past requests. The parent owns the
 * value and decides what a selection prefills; this field only suggests.
 */
export function SupplierNameField({ id, value, onChange, onSelect, placeholder, 'aria-label': ariaLabel }: Props) {
  const listboxId = useId()
  const [options, setOptions] = useState<SupplierSuggestion[]>([])
  const [highlighted, setHighlighted] = useState(-1)
  /** Query the dropdown was dismissed for (selection, Escape, blur); it stays closed until the query changes */
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  /** Latest trimmed query, so stale responses are discarded */
  const latestQuery = useRef('')

  const query = value.trim()
  // Visibility is derived: short queries and dismissed queries never show the list
  const showList = options.length > 0 && query.length >= MIN_QUERY && dismissedFor !== query

  useEffect(() => {
    latestQuery.current = query
    if (query.length < MIN_QUERY || dismissedFor === query) return

    let active = true
    const timeout = window.setTimeout(() => {
      void fetchSupplierSuggestions(query).then((results) => {
        // Stale-response guard: only the latest query may update the list
        if (!active || latestQuery.current !== query) return
        setOptions(results)
        setHighlighted(-1)
      })
    }, DEBOUNCE_MS)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [query, dismissedFor])

  function select(option: SupplierSuggestion) {
    setDismissedFor(option.supplier_name.trim())
    setOptions([])
    setHighlighted(-1)
    onSelect(option)
  }

  function dismiss() {
    // Record the dismissal only when the list was visible, so a query that
    // simply had no matches is fetched again when the user comes back to it
    if (showList) setDismissedFor(query)
    setOptions([])
    setHighlighted(-1)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (showList) {
        // Keep the surrounding StepModal's window-level Escape listener from firing
        e.stopPropagation()
        dismiss()
      }
      return
    }
    if (!showList) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => (h + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => (h <= 0 ? options.length - 1 : h - 1))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      const option = options[highlighted]
      if (option) {
        e.preventDefault() // don't submit the surrounding form/modal
        select(option)
      }
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listboxId : undefined}
        aria-activedescendant={showList && highlighted >= 0 ? `${listboxId}-option-${highlighted}` : undefined}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={dismiss}
        placeholder={placeholder}
        className={clsx(inputClass, 'border-transparent')}
      />
      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Supplier suggestions"
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-1.5 shadow-[0_16px_40px_-16px_rgba(24,20,18,0.25)]"
        >
          {options.map((option, index) => (
            <li
              key={`${option.supplier_name}-${index}`}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === highlighted}
              // MouseDown fires before the input's blur, so the click is not lost
              onMouseDown={(e) => {
                e.preventDefault()
                select(option)
              }}
              onMouseEnter={() => setHighlighted(index)}
              className={clsx('cursor-pointer rounded-xl px-3 py-2', index === highlighted && 'bg-[var(--canvas)]')}
            >
              <p className="truncate text-sm font-semibold text-[var(--ink)]">{option.supplier_name}</p>
              {option.supplier_address && <p className="truncate text-xs text-[var(--ink-soft)]">{option.supplier_address}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
