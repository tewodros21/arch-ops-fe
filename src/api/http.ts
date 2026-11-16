import { API_BASE_URL } from './config'
import type { ApiError, ErrorCode, Result } from './types'

// Fetch client for the Django REST API: JWT bearer auth, DRF page-number
// pagination, and DRF error bodies mapped to ApiError.

const SESSION_FLAG_KEY = 'archops.signedIn'
const ACCESS_TOKEN_KEY = 'archops.access'
const REFRESH_TOKEN_KEY = 'archops.refresh'
const PAGE_SIZE = 200

/** Keep authentication scoped to this tab and across page reloads. */
const flagStore: Storage | null = typeof window !== 'undefined' ? window.sessionStorage : null
function readStoredToken(key: string) {
  try {
    return flagStore?.getItem(key) ?? null
  } catch {
    return null
  }
}

let accessJwt = readStoredToken(ACCESS_TOKEN_KEY)
let refreshJwt = readStoredToken(REFRESH_TOKEN_KEY)

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
  /** false for public endpoints such as login and token refresh */
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

function storeTokens(access: string | null, refresh: string | null) {
  accessJwt = access
  refreshJwt = refresh
  try {
    if (access) flagStore?.setItem(ACCESS_TOKEN_KEY, access)
    else flagStore?.removeItem(ACCESS_TOKEN_KEY)
    if (refresh) flagStore?.setItem(REFRESH_TOKEN_KEY, refresh)
    else flagStore?.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // Keep tokens in memory when browser storage is unavailable.
  }
}

export function getRefreshToken() {
  return refreshJwt
}

/** Marks this tab signed in/out and notifies listeners when the flag flips */
export function setSession(signedIn: boolean, opts?: { quiet?: boolean }) {
  const wasSignedIn = readSignedInFlag()
  if (!signedIn) storeTokens(null, null)
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

/** @deprecated Prefer setTokens */
export function refreshToken(): null {
  return null
}

export function setTokens(tokens: { access?: string; refresh?: string } | null, opts?: { quiet?: boolean }) {
  if (!tokens?.access || !tokens.refresh) {
    setSession(false, opts)
    return
  }
  storeTokens(tokens.access, tokens.refresh)
  setSession(true, opts)
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
    storeTokens(null, null)
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
  if (opts.auth !== false && accessJwt) headers.Authorization = `Bearer ${accessJwt}`
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  try {
    return await fetch(url, { method, headers, body })
  } catch {
    return null
  }
}

let refreshPromise: Promise<boolean | null> | null = null

async function refreshAccessToken(): Promise<boolean | null> {
  if (!refreshJwt) return false
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const res = await send('POST', buildUrl('/auth/refresh/'), {
      body: { refresh: refreshJwt },
      auth: false,
    })
    if (!res) return null
    if (!res.ok) return false
    try {
      const tokens = (await res.json()) as { access?: string; refresh?: string }
      if (!tokens.access || !tokens.refresh) return false
      storeTokens(tokens.access, tokens.refresh)
      return true
    } catch {
      return false
    }
  })()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
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

  const allStrings = (value: unknown): string[] =>
    Array.isArray(value) ? value.flatMap(allStrings) : typeof value === 'string' ? [value] : []
  const fieldErrors = (errors: unknown) => {
    if (Array.isArray(errors)) {
      const messages = allStrings(errors)
      return messages.length ? [...new Set(messages)].join('; ') : null
    }
    if (!errors || typeof errors !== 'object') return null
    const messages = Object.entries(errors as Record<string, unknown>)
      .filter(([field]) => !['code', 'detail', 'errors'].includes(field))
      .flatMap(([field, value]) =>
        allStrings(value).map((message) =>
          field === 'non_field_errors' ? message : `${field.replace(/_/g, ' ')}: ${message}`,
        ),
      )
    return messages.length ? [...new Set(messages)].join('; ') : null
  }

  const message = fieldErrors(body?.errors) ?? fieldErrors(body) ?? allStrings(body?.detail)[0] ?? `Request failed (${res.status})`
  const code = KNOWN_CODES.has(body?.code as ErrorCode) ? (body!.code as ErrorCode) : (STATUS_CODES[res.status] ?? 'unknown')
  return { message, code }
}

export async function request<T>(method: string, path: string, opts: Options = {}): Promise<Result<T>> {
  const url = buildUrl(path, opts.query)
  let res = await send(method, url, opts)

  if (
    res?.status === 401 &&
    opts.auth !== false &&
    !path.includes('/auth/login/') &&
    !path.includes('/auth/refresh/')
  ) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      const retryOpts =
        path.includes('/auth/logout/') && typeof opts.body === 'object' && opts.body
          ? { ...opts, body: { ...(opts.body as Record<string, unknown>), refresh: refreshJwt } }
          : opts
      res = await send(method, url, retryOpts)
    } else if (refreshed === false) {
      setSession(false)
    }
  }

  if (!res) return { data: null, error: { message: 'Could not reach the server, check your connection', code: 'network' } }
  if (!res.ok) {
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
