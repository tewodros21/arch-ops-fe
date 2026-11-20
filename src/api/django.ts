import type {
  AppNotification,
  AuditEvent,
  Department,
  LaborRequest,
  Profile,
  Project,
  PurchaseDuplicate,
  PurchaseRequest,
  SiteEmployee,
  Vendor,
} from '@/types'
import { getRefreshToken, hasSession, http, list, onSessionChange, request, setSession, setTokens, type Page } from './http'
import type { Backend, ItemReceiptInput, ReceiptInput, Result, SiteEmployeeInput, SiteEmployeePatch, VendorHistory, VendorInput } from './types'

// Data source for the Django REST API. JWT auth; the server enforces roles,
// the approval workflow, audit and notifications.

const NOTIFICATION_POLL_MS = 15_000

/** Drops the response body for calls the UI only needs success / failure from */
async function done(call: Promise<Result<unknown>>): Promise<Result> {
  const { error } = await call
  return { data: null, error }
}

const save = <T>(path: string, input: unknown, id?: string) => (id ? http.patch<T>(`${path}${id}/`, input) : http.post<T>(path, input))

export const djangoBackend: Backend = {
  auth: {
    async me() {
      // Always probe the cookie session (flag alone is not enough after refresh)
      const { data, error } = await http.get<Profile>('/auth/me/')
      if (data) {
        setSession(true, { quiet: true })
        return data
      }
      if (error && hasSession()) setSession(false)
      return null
    },

    onChange: onSessionChange,

    async signIn(email, password) {
      const { data, error } = await request<{ access: string; refresh: string; user: Profile }>('POST', '/auth/login/', {
        body: { email, password },
        auth: false,
      })
      if (error) return { data: null, error }
      if (!data?.access || !data.refresh || !data.user) {
        return {
          data: null,
          error: { message: 'The server returned an incomplete sign-in response', code: 'unknown' },
        }
      }
      setTokens({ access: data.access, refresh: data.refresh })
      return { data: null, error: null }
    },

    async signOut() {
      try {
        const refresh = getRefreshToken()
        if (refresh) await http.post('/auth/logout/', { refresh })
      } finally {
        setSession(false)
      }
    },

    updateMe: (patch) => http.patch<Profile>('/auth/me/', patch),

    changePassword: (newPassword, currentPassword) =>
      done(http.post('/auth/change-password/', { current_password: currentPassword, new_password: newPassword })),

    requestPasswordReset: (email) =>
      done(request('POST', '/auth/password-reset/', { body: { email }, auth: false })),

    confirmPasswordReset: (uid, token, newPassword) =>
      done(request('POST', '/auth/password-reset/confirm/', { body: { uid, token, new_password: newPassword }, auth: false })),
  },

  profiles: {
    list: (opts = {}) => list<Profile>('/users/', { ordering: 'full_name' }, opts.limit),
    create: (input) => http.post<Profile>('/users/', input),
    update: (id, patch) => http.patch<Profile>(`/users/${id}/`, patch),
    remove: (id) => http.delete(`/users/${id}/`),
  },

  departments: {
    // member_count is always part of the payload
    list: (opts = {}) => list<Department>('/departments/', { ordering: 'name', is_active: opts.activeOnly ? true : undefined }),
    save: (input, id) => save<Department>('/departments/', input, id),
    remove: (id) => http.delete(`/departments/${id}/`),
  },

  siteEmployees: {
    list: (opts = {}) =>
      list<SiteEmployee>('/site-employees/', {
        department: opts.department,
        is_active: opts.activeOnly === undefined ? undefined : opts.activeOnly,
        search: opts.search,
      }),
    create: (input: SiteEmployeeInput) => http.post<SiteEmployee>('/site-employees/', input),
    update: (id: string, patch: SiteEmployeePatch) => http.patch<SiteEmployee>(`/site-employees/${id}/`, patch),
    remove: (id: string) => http.delete(`/site-employees/${id}/`),
  },

  projects: {
    // spent_amount is always part of the payload
    list: (opts = {}) => list<Project>('/projects/', { ordering: 'name', is_active: opts.activeOnly ? true : undefined }),
    save: (input, id) => save<Project>('/projects/', input, id),
    remove: (id) => http.delete(`/projects/${id}/`),
  },

  vendors: {
    list: (opts = {}) => list<Vendor>('/vendors/', { ordering: 'name', is_active: opts.activeOnly ? true : undefined }),
    get: (id) => http.get<Vendor>(`/vendors/${id}/`),
    save: (input: VendorInput, id) => save<Vendor>('/vendors/', input, id),
    history: (id) => http.get<VendorHistory>(`/vendors/${id}/history/`),
  },

  purchases: {
    list: () => list<PurchaseRequest>('/purchase-requests/', { ordering: '-created_at' }),
    get: (id) => http.get<PurchaseRequest>(`/purchase-requests/${id}/`),

    async count({ statuses, requesterId }) {
      const { data, error } = await http.get<Page<unknown>>('/purchase-requests/', { status: statuses, requester: requesterId, page_size: 1 })
      return error || !data ? { data: null, error } : { data: data.count, error: null }
    },

    async checkDuplicates(items, excludeRequestId) {
      const { data, error } = await http.post<PurchaseDuplicate[]>('/purchase-requests/duplicate-check/', {
        items,
        ...(excludeRequestId ? { exclude_request_id: excludeRequestId } : {}),
      })
      return error || !data ? { data: null, error } : { data, error: null }
    },

    async create(input) {
      const { data, error } = await http.post<PurchaseRequest>('/purchase-requests/', input)
      return error || !data ? { data: null, error } : { data: { id: data.id }, error: null }
    },

    update: (id, input) => done(http.patch(`/purchase-requests/${id}/`, input)),
    remove: (id) => http.delete(`/purchase-requests/${id}/`),
    replaceItems: (id, items) => done(http.put(`/purchase-requests/${id}/items/`, items)),
    addQuotation: (requestId, quote) => done(http.post(`/purchase-requests/${requestId}/quotations/`, quote)),
    removeQuotation: (quoteId) => http.delete(`/quotations/${quoteId}/`),
    selectQuotation: (_requestId, quoteId) => done(http.post(`/quotations/${quoteId}/select/`)),
    submit: (id) => done(http.post(`/purchase-requests/${id}/submit/`)),
    decide: (id, decision, comment, approvedAmount) =>
      done(http.post(`/purchase-requests/${id}/decide/`, {
        decision,
        comment: comment || null,
        ...(approvedAmount != null ? { approved_amount: approvedAmount } : {}),
      })),
    recordPurchase: (id, actualAmount) => done(http.post(`/purchase-requests/${id}/record-purchase/`, { actual_amount: actualAmount })),
    updateReceivedItems: (id, items: ItemReceiptInput[]) => done(http.post(`/purchase-requests/${id}/receive/`, { items })),
    receive: (id, input: ReceiptInput) => done(http.post(`/purchase-requests/${id}/receive/`, input)),
    complete: (id) => done(http.post(`/purchase-requests/${id}/complete/`)),
  },

  attachments: {
    upload(requestId, file, type, description, projectId) {
      const form = new FormData()
      form.append('file', file)
      form.append('attachment_type', type)
      if (description) form.append('description', description)
      if (projectId) form.append('project_id', projectId)
      return done(http.upload(`/purchase-requests/${requestId}/attachments/`, form))
    },

    async url(attachment) {
      const { data, error } = await http.get<{ url: string }>(`/attachments/${attachment.id}/download/`)
      return error || !data ? { data: null, error } : { data: data.url, error: null }
    },
  },

  labor: {
    list: () => list<LaborRequest>('/labor-requests/', { ordering: '-created_at' }),
    get: (id) => http.get<LaborRequest>(`/labor-requests/${id}/`),
    create: (input) => done(http.post('/labor-requests/', input)),
    update: (id, patch) => done(http.patch(`/labor-requests/${id}/`, patch)),
  },

  audit: {
    list: (q = {}) =>
      list<AuditEvent>(
        '/audit-events/',
        { ordering: q.ascending ? 'created_at' : '-created_at', since: q.since, entity_type: q.entity_type, entity_id: q.entity_id },
        q.limit,
      ),
  },

  notifications: {
    list: (limit) => list<AppNotification>('/notifications/', { ordering: '-created_at' }, limit),
    markRead: (id) => done(http.post(`/notifications/${id}/read/`)),
    markAllRead: () => done(http.post('/notifications/read-all/')),
    remove: (ids) => done(http.post('/notifications/bulk-delete/', { ids })),

    // Polls the newest page while the tab is visible. Swap for a WebSocket / SSE stream later
    // without touching the UI: only these handler calls matter.
    subscribe(_userId, handlers) {
      const seen = new Map<string, boolean>()
      let primed = false
      let stopped = false

      async function poll() {
        if (stopped || (primed && document.hidden)) return
        const { data } = await http.get<Page<AppNotification>>('/notifications/', { ordering: '-created_at', page_size: 50 })
        if (stopped || !data) return
        for (const n of [...data.results].reverse()) {
          const read = seen.get(n.id)
          if (read === undefined) {
            // The first poll only records what the hook already loaded
            if (primed) handlers.onInsert(n)
          } else if (read !== n.is_read) handlers.onUpdate(n)
          seen.set(n.id, n.is_read)
        }
        primed = true
      }

      poll()
      const timer = window.setInterval(poll, NOTIFICATION_POLL_MS)
      return () => {
        stopped = true
        window.clearInterval(timer)
      }
    },
  },
}
