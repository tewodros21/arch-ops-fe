import { API_BASE_URL } from './config'
import type { ApiError, ErrorCode, Result } from './types'

// Small fetch client for the Django REST API (public/docs/openapi.yaml): JWT bearer auth with one
// silent refresh on 401, DRF page-number pagination, and DRF error bodies mapped to ApiError.

const TOKEN_KEY = 'archops.auth'
const PAGE_SIZE = 200

interface Tokens {
  access: string
  refresh: string
}

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
  /** false for login / refresh, which must not send or refresh a token */
  auth?: boolean
}

// ── Tokens ───────────────────────────────────────────────────────────────────

const listeners = new Set<(signedIn: boolean) => void>()

function readTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as Tokens) : null
  } catch {
    return null
  }
}

export function hasSession() {
  return !!readTokens()
}

export function refreshToken() {
  return readTokens()?.refresh ?? null
}

/** Stores (or clears) the token pair and tells listeners when the signed-in state flips */
export function setTokens(tokens: Tokens | null) {
  const wasSignedIn = hasSession()
  try {
    if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage blocked (private mode): the session lasts until reload
  }
  if (wasSignedIn !== !!tokens) listeners.forEach((l) => l(!!tokens))
}

export function onSessionChange(listener: (signedIn: boolean) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Concurrent 401s share one refresh call
let refreshing: Promise<boolean> | null = null

function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const refresh = refreshToken()
    if (!refresh) return false
    const { data } = await request<Partial<Tokens>>('POST', '/auth/refresh/', { body: { refresh }, auth: false })
    if (!data?.access) {
      setTokens(null)
      return false
    }
    // With ROTATE_REFRESH_TOKENS the server sends a new refresh token too
    setTokens({ access: data.access, refresh: data.refresh ?? refresh })
    return true
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

// ── Requests ─────────────────────────────────────────────────────────────────

function buildUrl(path: string, query?: Query) {
  // Pagination "next" links come back absolute
  const url = new URL(/^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value == null || value === '') continue
    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }
  return url.toString()
}

async function send(method: string, url: string, opts: Options) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = opts.auth === false ? null : readTokens()?.access
  if (token) headers.Authorization = `Bearer ${token}`
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

const STATUS_CODES: Record<number, ErrorCode> = { 400: 'validation', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict' }
const KNOWN_CODES = new Set<ErrorCode>(['validation', 'unauthorized', 'account_deactivated', 'forbidden', 'not_found', 'conflict', 'in_use'])

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
  let res = await send(method, url, opts)

  if (res?.status === 401 && opts.auth !== false && hasSession() && (await refreshTokens())) {
    res = await send(method, url, opts)
  }
  if (!res) return { data: null, error: { message: 'Could not reach the server, check your connection', code: 'network' } }
  if (!res.ok) {
    // Refresh failed or the token was revoked: drop the session so the app shows the login page
    if (res.status === 401 && opts.auth !== false) setTokens(null)
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
