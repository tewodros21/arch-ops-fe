import { useSyncExternalStore } from 'react'
import { useAuth } from '@/context/AuthContext'

/**
 * Store Keeper screens are shown in Amharic by default. Everyone else stays in English.
 * Strings are keyed by their English text; `{name}` placeholders are filled from `vars`.
 * A Store Keeper can switch back to English, and the choice is remembered on this device.
 */
export type Lang = 'en' | 'am'

const STORAGE_KEY = 'archops.storekeeper.lang'

const AM: Record<string, string> = {
  // Navigation
  Overview: 'አጠቃላይ እይታ',
  'Purchase Requests': 'የግዢ ጥያቄዎች',
  'Purchase requests': 'የግዢ ጥያቄዎች',
  'Labor Requests': 'የሰራተኛ ጥያቄዎች',
  Home: 'መነሻ',
  Purchases: 'ግዢዎች',
  Labor: 'ሰራተኛ',
  More: 'ተጨማሪ',
  'Sign out': 'ውጣ',
  'Store Keeper': 'የመጋዘን ኃላፊ',

  // Statuses a Store Keeper sees
  Purchased: 'ተገዝቷል',
  'Partially Received': 'በከፊል ደርሷል',
  Completed: 'ተጠናቋል',

  // Dashboard
  'Store Keeper workspace': 'የመጋዘን ኃላፊ የስራ ቦታ',
  'Delivery tracking': 'የርክክብ ክትትል',
  'Record deliveries by item quantity. Financial details are hidden.':
    'የደረሱ ዕቃዎችን በብዛታቸው ይመዝግቡ። የገንዘብ መረጃዎች አይታዩም።',
  'open delivery requests': 'ያልተጠናቀቁ የርክክብ ጥያቄዎች',
  'Requests to receive': 'የሚረከቧቸው ጥያቄዎች',
  '{n} total': 'በአጠቃላይ {n}',
  'Loading delivery requests…': 'የርክክብ ጥያቄዎች በመጫን ላይ…',
  'No purchased requests are waiting for delivery.': 'ርክክብ የሚጠብቅ የተገዛ ጥያቄ የለም።',
  '{n} remaining': '{n} ቀሪ',
  'Open delivery details →': 'የርክክብ ዝርዝሩን ይክፈቱ →',

  // Request list
  '{n} delivery requests to track': 'ለመከታተል {n} የርክክብ ጥያቄዎች',
  All: 'ሁሉም',
  'Delivery & completed': 'ርክክብ እና የተጠናቀቁ',
  Request: 'ጥያቄ',
  Project: 'ፕሮጀክት',
  Delivery: 'ርክክብ',
  Status: 'ሁኔታ',
  'Loading requests…': 'ጥያቄዎች በመጫን ላይ…',
  'Nothing here': 'እዚህ ምንም የለም',
  'No requests match this filter.': 'ከዚህ ማጣሪያ ጋር የሚዛመድ ጥያቄ የለም።',
  '{n} items remaining': '{n} ዕቃዎች ይቀራሉ',
  'Results for “{q}”': 'የ“{q}” ውጤቶች',

  // Request detail
  'Loading request…': 'ጥያቄው በመጫን ላይ…',
  'Request not found': 'ጥያቄው አልተገኘም',
  'This purchase request could not be opened.': 'ይህን የግዢ ጥያቄ መክፈት አልተቻለም።',
  'Back to requests': 'ወደ ጥያቄዎች ተመለስ',
  Items: 'ዕቃዎች',
  Item: 'ዕቃ',
  'No line items listed.': 'ምንም ዕቃ አልተዘረዘረም።',
  Received: 'የደረሰ',
  Remaining: 'ቀሪ',
  'Receive now': 'አሁን የሚረከቡት',
  'Record received quantities': 'የደረሱትን ብዛቶች ይመዝግቡ',
  Supplier: 'አቅራቢ',
  'Supplier location': 'የአቅራቢ አድራሻ',
  'Not provided': 'አልተሰጠም',
  'Close it out': 'ጥያቄውን ይዝጉ',
  'All item quantities are received. Mark the request complete.':
    'ሁሉም ዕቃዎች ደርሰዋል። ጥያቄውን እንደተጠናቀቀ ምልክት ያድርጉ።',
  'Mark as completed': 'እንደተጠናቀቀ ምልክት አድርግ',
  'Mark as completed?': 'እንደተጠናቀቀ ምልክት ይደረግ?',
  'All ordered item quantities have been received. This closes the request.':
    'የታዘዙት ዕቃዎች በሙሉ ደርሰዋል። ይህ ጥያቄውን ይዘጋል።',
  'Mark completed': 'አጠናቅቅ',
  'Delivery quantities recorded': 'የደረሱ ብዛቶች ተመዝግበዋል',
  'Could not record this delivery': 'ርክክቡን መመዝገብ አልተቻለም',
  'Enter a received quantity for at least one item': 'ቢያንስ ለአንድ ዕቃ የደረሰውን ብዛት ያስገቡ',
  'A received quantity cannot exceed the remaining quantity': 'የደረሰው ብዛት ከቀሪው ብዛት መብለጥ አይችልም',
  'Request marked as completed, all done here': 'ጥያቄው እንደተጠናቀቀ ተመዝግቧል',
  'Could not complete this request': 'ጥያቄውን ማጠናቀቅ አልተቻለም',
  'Quantity received now for {name}': 'ለ{name} አሁን የደረሰ ብዛት',

  // Language switch
  Language: 'ቋንቋ',
}

const listeners = new Set<() => void>()

function readStored(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'am'
  } catch {
    return 'am'
  }
}

let current: Lang = readStored()

export function setStoreKeeperLang(lang: Lang) {
  current = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Private mode: the choice lasts for this tab only
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function fill(text: string, vars?: Record<string, string | number>) {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))
}

export function translate(lang: Lang, en: string, vars?: Record<string, string | number>) {
  return fill(lang === 'am' ? (AM[en] ?? en) : en, vars)
}

/** The language this user's screens use: Amharic only for Store Keepers who have not switched to English */
export function useLang(): Lang {
  const { profile } = useAuth()
  const stored = useSyncExternalStore(subscribe, () => current, () => current)
  return profile?.role === 'shopkeeper' ? stored : 'en'
}

export function useT() {
  const lang = useLang()
  return (en: string, vars?: Record<string, string | number>) => translate(lang, en, vars)
}
