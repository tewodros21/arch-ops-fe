import { useCallback, useEffect, useState } from 'react'

export type CalendarSystem = 'ethiopian' | 'gregorian'

export const CALENDAR_STORAGE_KEY = 'archops.calendar'
export const CALENDAR_CHANGE_EVENT = 'archops:calendar-change'

export function getCalendarPreference(): CalendarSystem {
  try {
    const raw = localStorage.getItem(CALENDAR_STORAGE_KEY)
    if (raw === 'gregorian' || raw === 'ethiopian') return raw
  } catch {
    /* ignore */
  }
  return 'ethiopian'
}

function readPreference(): CalendarSystem {
  return getCalendarPreference()
}

/** App-wide calendar preference. Defaults to Ethiopian; stored in localStorage. */
export function useCalendarPreference() {
  const [calendar, setCalendarState] = useState<CalendarSystem>(() =>
    typeof window === 'undefined' ? 'ethiopian' : readPreference(),
  )

  useEffect(() => {
    function sync() {
      setCalendarState(readPreference())
    }
    window.addEventListener('storage', sync)
    window.addEventListener(CALENDAR_CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(CALENDAR_CHANGE_EVENT, sync)
    }
  }, [])

  const setCalendar = useCallback((next: CalendarSystem) => {
    try {
      localStorage.setItem(CALENDAR_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    setCalendarState(next)
    window.dispatchEvent(new Event(CALENDAR_CHANGE_EVENT))
  }, [])

  return { calendar, setCalendar, isEthiopian: calendar === 'ethiopian' }
}
