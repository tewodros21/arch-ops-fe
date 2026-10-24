import { useCallback, useEffect, useRef, useState } from 'react'
import { backend } from '@/api'
import type { AppNotification } from '@/types'

const LIMIT = 50

// The signed-in user's notifications, kept live by polling the API (see notifications.subscribe).
// Rows are created server side; the app only reads, marks read and deletes.
export function useNotifications(userId: string | undefined, onNew?: (n: AppNotification) => void) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const onNewRef = useRef(onNew)

  useEffect(() => {
    onNewRef.current = onNew
  })

  useEffect(() => {
    if (!userId) return
    let active = true

    backend.notifications.list(LIMIT).then(({ data, error }) => {
      if (!active) return
      if (error) console.error('Error fetching notifications:', error)
      setItems(data ?? [])
      setLoading(false)
    })

    const unsubscribe = backend.notifications.subscribe(userId, {
      onInsert(n) {
        setItems((list) => (list.some((i) => i.id === n.id) ? list : [n, ...list].slice(0, LIMIT)))
        onNewRef.current?.(n)
      },
      onUpdate(n) {
        setItems((list) => list.map((i) => (i.id === n.id ? { ...i, ...n } : i)))
      },
      onDelete(id) {
        setItems((list) => list.filter((i) => i.id !== id))
      },
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [userId])

  const markRead = useCallback(async (id: string) => {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    const { error } = await backend.notifications.markRead(id)
    if (error) console.error('Error marking notification read:', error)
  }, [])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    setItems((list) => list.map((n) => ({ ...n, is_read: true })))
    const { error } = await backend.notifications.markAllRead()
    if (error) console.error('Error marking notifications read:', error)
  }, [userId])

  const dismiss = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    setItems((list) => list.filter((n) => !ids.includes(n.id)))
    const { error } = await backend.notifications.remove(ids)
    if (error) console.error('Error deleting notifications:', error)
  }, [])

  // Signed out: nothing to show (the list is refilled on the next sign in)
  const visible = userId ? items : []
  const unread = visible.filter((n) => !n.is_read).length

  return { items: visible, loading: !!userId && loading, unread, markRead, markAllRead, dismiss }
}
