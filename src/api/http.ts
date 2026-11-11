import { API_BASE_URL } from './config'
import type { ApiError, ErrorCode, Result } from './types'

// Fetch client for the Django REST API: cookie session auth + CSRF, DRF page-number
// pagination, and DRF error bodies mapped to ApiError.

const SESSION_FLAG_KEY = 'archops.signedIn'
const PAGE_SIZE = 200

/** Per-tab signed-in flag only (the real session lives in the httpOnly cookie) */
const flagStore: Storage | null = typeof window !== 'undefined' ? window.sessionStorage : null

export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

type QueryValue = string | number | boolean | null | undefined | string[]
export type Query = Record<string, QueryValue>

interface Options {
  query?: Query
  body?: unknown
  form?: FormData
  /** false for csrf / login, which must work without an existing session */
  auth?: boolean
}

// ── Session flag (UI only) ───────────────────────────────────────────────────

const listeners = new Set<(signedIn: boolean) => void>()

function readSignedInFlag() {
  try {
    return flagStore?.getItem(SESSION_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

export function hasSession() {
  return readSignedInFlag()
}

/** Marks this tab signed in/out and notifies listeners when the flag flips */
export function setSession(signedIn: boolean, opts?: { quiet?: boolean }) {
  const wasSignedIn = readSignedInFlag()
  try {
    if (signedIn) flagStore?.setItem(SESSION_FLAG_KEY, '1')
    else flagStore?.removeItem(SESSION_FLAG_KEY)
  } catch {
    // Storage blocked (private mode): the flag lasts until reload
  }
  if (opts?.quiet) return
  if (wasSignedIn !== signedIn) {
    listeners.forEach((l) => l(signedIn))
  }
}

export function onSessionChange(listener: (signedIn: boolean) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** @deprecated Kept for call-site compatibility; session auth has no refresh token */
export function refreshToken(): null {
  return null
}

/** @deprecated Use setSession */
export function setTokens(tokens: { access?: string; refresh?: string } | null, opts?: { quiet?: boolean }) {
  setSession(!!tokens, opts)
}

/**
 * Browsers can clone sessionStorage into a tab opened from this app (window.opener).
 * Drop the cloned signed-in flag so the new tab must establish its own server session.
 */
function dropAuthClonedFromOpener() {
  try {
    if (!window.opener || window.opener === window) return
    try {
      void window.opener.location.origin
    } catch {
      return
    }
    flagStore?.removeItem(SESSION_FLAG_KEY)
  } catch {
    // ignore
  }
}

if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('archops.auth')
  } catch {
    // ignore
  }
  dropAuthClonedFromOpener()
}

// ── CSRF ─────────────────────────────────────────────────────────────────────

function readCookie(name: string) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&')}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

let csrfReady: Promise<string | null> | null = null

/** Ensures the csrftoken cookie exists and returns its value */
export async function ensureCsrf(): Promise<string | null> {
  const existing = readCookie('csrftoken')
  if (existing) return existing
  csrfReady ??= (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/csrf/`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return readCookie('csrftoken')
      const data = (await res.json()) as { csrfToken?: string }
      return data.csrfToken ?? readCookie('csrftoken')
    } catch {
      return readCookie('csrftoken')
    } finally {
      csrfReady = null
    }
  })()
  return csrfReady
}

// ── Requests ─────────────────────────────────────────────────────────────────

function buildUrl(path: string, query?: Query) {
  const url = new URL(/^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value == null || value === '') continue
    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }
  return url.toString()
}

async function send(method: string, url: string, opts: Options) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const unsafe = !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method.toUpperCase())
  if (unsafe) {
    const csrf = await ensureCsrf()
    if (csrf) headers['X-CSRFToken'] = csrf
  }
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  try {
    return await fetch(url, { method, headers, body, credentials: 'include' })
  } catch {
    return null
  }
}

const STATUS_CODES: Record<number, ErrorCode> = { 400: 'validation', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict' }
const KNOWN_CODES = new Set<ErrorCode>([
  'validation',
  'unauthorized',
  'account_deactivated',
  'forbidden',
  'not_found',
  'conflict',
  'in_use',
  'sent_back',
  'with_requester',
])

/** Reads { detail, code, errors } (the documented shape) and plain DRF field-error bodies */
async function parseError(res: Response): Promise<ApiError> {
  let body: Record<string, unknown> | null = null
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    // Non-JSON error page
  }

  const first = (value: unknown): string | null => (Array.isArray(value) ? first(value[0]) : typeof value === 'string' ? value : null)
  const fieldErrors = (errors: unknown) => {
    if (!errors || typeof errors !== 'object') return null
    for (const [field, value] of Object.entries(errors as Record<string, unknown>)) {
      const msg = first(value)
      if (msg) return field === 'non_field_errors' || field === 'detail' ? msg : `${field.replace(/_/g, ' ')}: ${msg}`
    }
    return null
  }

  const message = first(body?.detail) ?? fieldErrors(body?.errors) ?? fieldErrors(body) ?? `Request failed (${res.status})`
  const code = KNOWN_CODES.has(body?.code as ErrorCode) ? (body!.code as ErrorCode) : (STATUS_CODES[res.status] ?? 'unknown')
  return { message, code }
}

export async function request<T>(method: string, path: string, opts: Options = {}): Promise<Result<T>> {
  const url = buildUrl(path, opts.query)
  const res = await send(method, url, opts)

  if (!res) return { data: null, error: { message: 'Could not reach the server, check your connection', code: 'network' } }
  if (!res.ok) {
    // Cookie session gone: clear the tab flag when /auth/me/ fails
    if ((res.status === 401 || res.status === 403) && path.includes('/auth/me/') && hasSession()) {
      setSession(false)
    }
    return { data: null, error: await parseError(res) }
  }
  if (res.status === 204) return { data: null, error: null }
  const text = await res.text()
  return { data: (text ? JSON.parse(text) : null) as T, error: null }
}

/** Follows "next" links until every row (or `max` rows) is loaded */
export async function list<T>(path: string, query: Query = {}, max = Infinity): Promise<Result<T[]>> {
  const rows: T[] = []
  let next: string | null = path
  let pageQuery: Query | undefined = { page_size: Math.min(PAGE_SIZE, max), ...query }
  while (next && rows.length < max) {
    const { data, error }: Result<Page<T>> = await request<Page<T>>('GET', next, { query: pageQuery })
    if (error || !data) return { data: null, error }
    rows.push(...data.results)
    next = data.next
    pageQuery = undefined
  }
  return { data: rows.slice(0, max), error: null }
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} }),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: (path: string) => request<null>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, { form }),
}
