import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendarPreference, type CalendarSystem } from '@/hooks/useCalendarPreference'
import {
  daysInEthiopianMonth,
  ethiopianToIso,
  formatDateWithEthiopian,
  parseCalendarDate,
  toEthiopian,
  toIsoDateString,
  ETHIOPIAN_MONTHS_EN,
  type EthiopianDate,
} from '@/utils/ethiopianDate'

/** Match browser native `<input type="date">` UI font (GC picker). */
const calFontStyle = {
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
} as const

type Props = {
  value: string
  onChange: (isoDate: string) => void
  min?: string
  className?: string
  inputClassName?: string
  optional?: boolean
}

function isoToday() {
  return toIsoDateString(new Date())
}

function clampEthiopian(eth: EthiopianDate): EthiopianDate {
  const maxDay = daysInEthiopianMonth(eth.year, eth.month) || 1
  return { ...eth, day: Math.min(Math.max(eth.day, 1), maxDay) }
}

/** Same shape as GC: mm/dd/yyyy, but month/day/year are Ethiopian. */
function formatEthTyped(eth: EthiopianDate): string {
  const mm = String(eth.month).padStart(2, '0')
  const dd = String(eth.day).padStart(2, '0')
  return `${mm}/${dd}/${eth.year}`
}

function parseEthTyped(raw: string): EthiopianDate | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (slash) {
    const month = Number(slash[1])
    const day = Number(slash[2])
    const year = Number(slash[3])
    if (month < 1 || month > 13) return null
    const max = daysInEthiopianMonth(year, month)
    if (day < 1 || day > max) return null
    return { year, month, day }
  }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    if (month < 1 || month > 13) return null
    const max = daysInEthiopianMonth(year, month)
    if (day < 1 || day > max) return null
    return { year, month, day }
  }
  return null
}

export function CalendarDateField({ value, onChange, min, className, inputClassName, optional }: Props) {
  const { calendar, setCalendar } = useCalendarPreference()
  const minIso = min || undefined
  const parsed = parseCalendarDate(value)
  const ethValue = parsed ? toEthiopian(parsed) : null

  return (
    <div className={clsx('space-y-2', className)} style={calFontStyle}>
      <div className="flex justify-end">
        <CalendarSwitch calendar={calendar} onChange={setCalendar} />
      </div>
      {calendar === 'ethiopian' ? (
        <EthiopianPicker
          value={ethValue}
          minIso={minIso}
          optional={optional}
          onChange={(eth) => onChange(ethiopianToIso(eth))}
          onClear={() => onChange('')}
          inputClassName={inputClassName}
        />
      ) : (
        <div className="relative">
          <CalendarDays size={18} className="pointer-events-none absolute top-1/2 left-4 z-[1] -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            value={value}
            min={minIso}
            onChange={(e) => onChange(e.target.value)}
            className={clsx(inputClassName, 'border-transparent pl-11')}
            style={calFontStyle}
          />
        </div>
      )}
      {value ? (
        <p className="text-xs text-[var(--ink-soft)]">{formatDateWithEthiopian(value, undefined, calendar)}</p>
      ) : null}
    </div>
  )
}

function CalendarSwitch({
  calendar,
  onChange,
}: {
  calendar: CalendarSystem
  onChange: (next: CalendarSystem) => void
}) {
  const options = [
    { value: 'gregorian' as const, label: 'GC', title: 'Gregorian calendar' },
    { value: 'ethiopian' as const, label: 'ET', title: 'Ethiopian calendar' },
  ]

  return (
    <div
      role="group"
      aria-label="Calendar system"
      title="GC = Gregorian · ET = Ethiopian"
      className="inline-flex rounded-full border border-black/10 bg-white p-1"
      style={calFontStyle}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-label={option.title}
          aria-pressed={calendar === option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            'focus-ring min-w-10 rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-colors',
            calendar === option.value
              ? 'bg-[var(--ink)] text-white'
              : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function EthiopianPicker({
  value,
  minIso,
  optional,
  onChange,
  onClear,
  inputClassName,
}: {
  value: EthiopianDate | null
  minIso?: string
  optional?: boolean
  onChange: (eth: EthiopianDate) => void
  onClear: () => void
  inputClassName?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [typed, setTyped] = useState(() => (value ? formatEthTyped(value) : ''))
  const [invalid, setInvalid] = useState(false)
  const todayEth = toEthiopian(new Date())
  const [view, setView] = useState<EthiopianDate>(() => value ?? todayEth)

  useEffect(() => {
    setTyped(value ? formatEthTyped(value) : '')
    setInvalid(false)
    if (value) setView({ year: value.year, month: value.month, day: value.day })
  }, [value?.year, value?.month, value?.day])

  useLayoutEffect(() => {
    if (!open || !inputRef.current) {
      setPanelPos(null)
      return
    }
    function place() {
      const rect = inputRef.current!.getBoundingClientRect()
      const panelHeight = 360
      const gap = 8
      const spaceBelow = window.innerHeight - rect.bottom
      const openDown = spaceBelow >= panelHeight + gap
      const top = openDown ? rect.bottom + gap : Math.max(12, rect.top - panelHeight - gap)
      const width = Math.max(rect.width, 300)
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12)
      setPanelPos({ top, left, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if ((e.target as HTMLElement)?.closest?.('[data-et-calendar-panel]')) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const days = daysInEthiopianMonth(view.year, view.month)
  const minDate = minIso ? parseCalendarDate(minIso) : null
  const yearOptions = useMemo(() => {
    const base = todayEth.year
    return Array.from({ length: 16 }, (_, i) => base - 4 + i)
  }, [todayEth.year])

  function commitTyped(raw: string) {
    if (!raw.trim()) {
      if (optional) {
        onClear()
        setInvalid(false)
        return true
      }
      setInvalid(true)
      return false
    }
    const eth = parseEthTyped(raw)
    if (!eth) {
      setInvalid(true)
      return false
    }
    const greg = parseCalendarDate(ethiopianToIso(eth))
    if (minDate && greg && greg < minDate) {
      setInvalid(true)
      return false
    }
    onChange(eth)
    setTyped(formatEthTyped(eth))
    setInvalid(false)
    return true
  }

  function pick(day: number) {
    const next = clampEthiopian({ year: view.year, month: view.month, day })
    const greg = parseCalendarDate(ethiopianToIso(next))
    if (minDate && greg && greg < minDate) return
    onChange(next)
    setTyped(formatEthTyped(next))
    setInvalid(false)
    setOpen(false)
  }

  function shiftMonth(delta: number) {
    let { year, month } = view
    month += delta
    while (month < 1) {
      month += 13
      year -= 1
    }
    while (month > 13) {
      month -= 13
      year += 1
    }
    setView(clampEthiopian({ year, month, day: 1 }))
  }

  const panel =
    open && panelPos
      ? createPortal(
          <div
            data-et-calendar-panel
            role="dialog"
            aria-label="Ethiopian calendar"
            className="fixed z-[80] rounded-2xl border border-black/10 bg-white p-3 shadow-[0_16px_48px_rgba(24,20,18,0.18)]"
            style={{ ...calFontStyle, top: panelPos.top, left: panelPos.left, width: panelPos.width }}
          >
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <select
                value={view.month}
                onChange={(e) => setView(clampEthiopian({ ...view, month: Number(e.target.value), day: 1 }))}
                className="field !min-w-0 !flex-1 !rounded-lg !border-black/10 !bg-white !py-1.5 text-sm font-semibold"
                style={calFontStyle}
                aria-label="Ethiopian month"
              >
                {ETHIOPIAN_MONTHS_EN.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={view.year}
                onChange={(e) => setView(clampEthiopian({ ...view, year: Number(e.target.value), day: 1 }))}
                className="field !w-[5.5rem] !shrink-0 !rounded-lg !border-black/10 !bg-white !py-1.5 text-sm font-semibold tabular-nums"
                style={calFontStyle}
                aria-label="Ethiopian year"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: days }, (_, i) => {
                const day = i + 1
                const eth = { year: view.year, month: view.month, day }
                const greg = parseCalendarDate(ethiopianToIso(eth))
                const disabled = !!(minDate && greg && greg < minDate)
                const selected = value?.year === eth.year && value.month === eth.month && value.day === eth.day
                const isToday =
                  todayEth.year === eth.year && todayEth.month === eth.month && todayEth.day === eth.day
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(day)}
                    className={clsx(
                      'focus-ring flex h-9 items-center justify-center rounded-md text-sm font-semibold tabular-nums transition-colors',
                      selected && 'bg-[#0b57d0] text-white',
                      !selected && isToday && 'text-[#0b57d0] ring-1 ring-[#0b57d0]',
                      !selected && !isToday && !disabled && 'text-[var(--ink)] hover:bg-black/[0.04]',
                      disabled && 'cursor-not-allowed text-slate-300',
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-2">
              {optional ? (
                <button
                  type="button"
                  className="focus-ring rounded px-2 py-1 text-sm font-semibold text-[#0b57d0]"
                  onClick={() => {
                    onClear()
                    setTyped('')
                    setInvalid(false)
                    setOpen(false)
                  }}
                >
                  Clear
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="focus-ring rounded px-2 py-1 text-sm font-semibold text-[#0b57d0]"
                onClick={() => {
                  const today = toEthiopian(new Date())
                  const todayIso = isoToday()
                  if (minIso && todayIso < minIso) return
                  onChange(today)
                  setTyped(formatEthTyped(today))
                  setInvalid(false)
                  setOpen(false)
                }}
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className="relative" style={calFontStyle}>
      <div className="relative">
        <CalendarDays
          size={18}
          className="pointer-events-none absolute top-1/2 left-4 z-[1] -translate-y-1/2 text-slate-400"
        />
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          placeholder="mm/dd/yyyy"
          value={typed}
          aria-invalid={invalid}
          aria-label="Ethiopian date (mm/dd/yyyy)"
          onChange={(e) => {
            setTyped(e.target.value)
            setInvalid(false)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Defer so a day click inside the portal still registers
            window.setTimeout(() => {
              if (document.activeElement?.closest?.('[data-et-calendar-panel]')) return
              commitTyped(typed)
            }, 120)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (commitTyped(typed)) setOpen(false)
            }
          }}
          className={clsx(
            inputClassName,
            'border-transparent pl-11 pr-10 tabular-nums',
            invalid && '!border-[var(--accent)]',
          )}
          style={calFontStyle}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Open Ethiopian calendar"
          className="absolute top-1/2 right-3 z-[1] -translate-y-1/2 rounded p-1 text-slate-400 hover:text-[var(--ink)]"
          onMouseDown={(e) => {
            e.preventDefault()
            setOpen((v) => !v)
            inputRef.current?.focus()
          }}
        >
          <CalendarDays size={16} />
        </button>
      </div>
      {invalid ? (
        <p className="mt-1 text-xs font-medium text-[var(--accent)]">Enter a valid ET date as mm/dd/yyyy</p>
      ) : null}
      {panel}
    </div>
  )
}
