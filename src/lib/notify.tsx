import toast from 'react-hot-toast'
import { Toast, type ToastLevel } from '@/components/ui/Toast'

const MAX_WORDS = 10
const MAX_VISIBLE = 3

// Errors stay up a little longer; hovering any toast pauses them all
const DURATION: Record<ToastLevel, number> = { success: 4000, info: 4000, warning: 6000, error: 7000 }

// Newest last. Anything that is not among the last three is already gone or gets pushed out.
const recent: string[] = []

// Toasts stay short: anything past ten words is cut with an ellipsis
function clamp(message: string) {
  const words = message.trim().split(/\s+/)
  return words.length <= MAX_WORDS ? message.trim() : `${words.slice(0, MAX_WORDS).join(' ')}…`
}

function show(level: ToastLevel, message: string) {
  const id = toast.custom((t) => <Toast t={t} level={level} message={clamp(message)} />, {
    duration: DURATION[level],
    removeDelay: 300,
  })
  recent.push(id)
  while (recent.length > MAX_VISIBLE) toast.dismiss(recent.shift())
  return id
}

export const notify = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
  warning: (message: string) => show('warning', message),
  info: (message: string) => show('info', message),
}
