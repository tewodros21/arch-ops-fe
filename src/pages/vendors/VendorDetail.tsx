import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowUpRight, FileText, Mail, MapPin, Pencil, Phone, ShoppingBag, User } from 'lucide-react'
import { Avatar, Breadcrumbs, Button, StatusBadge } from '@/components/ui'
import { VendorFormModal } from '@/components/admin/VendorFormModal'
import { useAuth } from '@/context/AuthContext'
import { notify } from '@/lib/notify'
import { openAttachment } from '@/lib/storage'
import { fetchVendor, fetchVendorHistory, VENDOR_MANAGER_ROLES, type VendorHistory, type VendorQuoteRow } from '@/services'
import { getInitials } from '@/utils'
import type { Vendor } from '@/types'

const money = (n: number) => `$${Math.round(n).toLocaleString()}`

// How this quote compared with the others on the same request
function priceHint(q: VendorQuoteRow): { label: string; tone: 'sun' | 'muted' | 'plain' } {
  const amount = Number(q.amount)
  if (q.competing.length < 2) return { label: 'Only quote', tone: 'plain' }
  const lowest = Math.min(...q.competing)
  if (amount <= lowest) return { label: `Lowest of ${q.competing.length}`, tone: 'sun' }
  const pct = Math.round(((amount - lowest) / lowest) * 100)
  return { label: `+${pct}% vs lowest`, tone: 'muted' }
}

export function VendorDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [history, setHistory] = useState<VendorHistory>({ quotes: [], documents: [] })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const canManage = !!profile && VENDOR_MANAGER_ROLES.includes(profile.role)

  useEffect(() => {
    if (!id) return
    let active = true
    Promise.all([fetchVendor(id), fetchVendorHistory(id)]).then(([v, h]) => {
      if (!active) return
      setVendor(v)
      setHistory(h)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id])

  if (loading) return <p className="py-16 text-center text-sm text-slate-500">Loading vendor…</p>
  if (!vendor)
    return (
      <div className="rounded-[1.75rem] bg-white px-6 py-16 text-center">
        <p className="text-2xl font-black text-[var(--ink)]">Vendor not found</p>
        <Link to="/vendors" className="mt-3 inline-block text-sm font-medium text-[var(--accent)] underline underline-offset-4">
          Back to vendors
        </Link>
      </div>
    )

  const { quotes, documents } = history
  const won = quotes.filter((q) => q.is_selected)
  const purchases = won.filter((q) => q.request && (q.request.status === 'purchased' || q.request.status === 'completed'))
  const purchasedTotal = purchases.reduce((sum, q) => sum + Number(q.request?.actual_amount ?? q.request?.approved_amount ?? q.amount), 0)
  const avgQuote = quotes.length ? quotes.reduce((sum, q) => sum + Number(q.amount), 0) / quotes.length : 0
  const services = (vendor.services ?? '').split(/,\s*/).filter(Boolean)

  async function openDoc(doc: VendorHistory['documents'][number]) {
    const { error } = await openAttachment(doc)
    if (error) notify.error(`Could not open this file: ${error}`)
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Overview', to: '/dashboard' }, { label: 'Vendors', to: '/vendors' }, { label: vendor.name }]} />

      {/* ── Hero ── */}
      <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar initials={getInitials(vendor.name)} size={64} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-semibold text-white">Vendor</span>
                {vendor.is_active === false && <span className="rounded-full bg-[var(--canvas)] px-3 py-1 text-xs font-semibold text-slate-500">Inactive</span>}
              </div>
              <h1 className="mt-2 text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] font-black tracking-[-0.035em] break-words text-[var(--ink)]">{vendor.name}</h1>
            </div>
          </div>
          {canManage && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil size={15} />
              Edit vendor
            </Button>
          )}
        </div>

        {services.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {services.map((s) => (
              <span key={s} className="rounded-full bg-[var(--canvas)] px-2.5 py-1 text-xs text-[var(--ink)]">{s}</span>
            ))}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-black/[0.06] pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Meta label="Contact" icon={User}>{vendor.contact_person || 'Not set'}</Meta>
          <Meta label="Phone" icon={Phone}>
            {vendor.phone ? <a href={`tel:${vendor.phone}`} className="hover:text-[var(--accent)]">{vendor.phone}</a> : 'Not set'}
          </Meta>
          <Meta label="Email" icon={Mail}>
            {vendor.email ? <a href={`mailto:${vendor.email}`} className="hover:text-[var(--accent)]">{vendor.email}</a> : 'Not set'}
          </Meta>
          <Meta label="Address" icon={MapPin}>{vendor.address || 'Not set'}</Meta>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Quotes given" value={String(quotes.length)} />
        <Stat label="Times selected" value={String(won.length)} hint={quotes.length ? `${Math.round((won.length / quotes.length) * 100)}% win rate` : undefined} />
        <Stat label="Total purchased" value={money(purchasedTotal)} hint={`${purchases.length} purchase${purchases.length === 1 ? '' : 's'}`} highlight />
        <Stat label="Average quote" value={quotes.length ? money(avgQuote) : '—'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ── Pricing history ── */}
        <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
          <SectionTitle title="Pricing history" count={quotes.length} />
          {quotes.length === 0 ? (
            <p className="text-sm text-slate-500">This vendor has not quoted on any request yet.</p>
          ) : (
            <ul className="space-y-2">
              {quotes.map((q) => {
                const hint = priceHint(q)
                return (
                  <li key={q.id}>
                    <Link
                      to={`/requests/${q.purchase_request_id}`}
                      className="focus-ring group flex flex-col gap-3 rounded-2xl bg-[var(--canvas)] px-4 py-3.5 transition-colors hover:bg-[#ebe7e2] sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ink)]">{q.request?.request_number}</span>
                          {q.request && <StatusBadge status={q.request.status} />}
                          {q.is_selected && <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 text-[11px] text-white">Selected</span>}
                        </div>
                        <p className="mt-1.5 truncate text-sm font-semibold text-[var(--ink)]">{q.request?.title}</p>
                        <p className="text-xs text-slate-500">
                          {q.request?.project?.name ? `${q.request.project.name} · ` : ''}
                          Quoted {format(new Date(q.created_at), 'MMM d, yyyy')}
                          {q.valid_until ? ` · valid until ${format(new Date(`${q.valid_until}T00:00`), 'MMM d')}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
                        <span className="text-lg font-bold text-[var(--ink)]">${Number(q.amount).toLocaleString()}</span>
                        <span
                          className={
                            hint.tone === 'sun'
                              ? 'rounded-full bg-[var(--sun)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink)]'
                              : hint.tone === 'muted'
                                ? 'rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]'
                                : 'rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500'
                          }
                        >
                          {hint.label}
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          {/* ── Purchases ── */}
          <section className="panel-dark relative overflow-hidden rounded-[1.75rem] p-6">
            <div className="relative">
              <span className="rounded-full bg-[var(--sun)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">Purchase history</span>
              <p className="mt-3 text-3xl leading-none font-black text-white">{money(purchasedTotal)}</p>
              <p className="mt-1.5 text-xs text-white/60">Paid across purchased and completed requests</p>
              {purchases.length === 0 ? (
                <p className="mt-5 text-sm text-white/60">No purchases from this vendor yet.</p>
              ) : (
                <ul className="mt-5 space-y-1.5">
                  {purchases.map((q) => (
                    <li key={q.id}>
                      <Link
                        to={`/requests/${q.purchase_request_id}`}
                        className="focus-ring group flex items-center gap-3 rounded-2xl bg-white/[0.07] px-3 py-2.5 transition-colors hover:bg-white/[0.12]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                          <ShoppingBag size={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-white">{q.request?.title}</p>
                          <p className="text-xs text-white/45">
                            {q.request?.request_number} · {q.request && format(new Date(q.request.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-white">
                          {money(Number(q.request?.actual_amount ?? q.request?.approved_amount ?? q.amount))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* ── Documents ── */}
          <section className="rounded-[1.75rem] bg-white p-6">
            <SectionTitle title="Quotation files" count={documents.length} />
            {documents.length === 0 ? (
              <p className="text-sm text-slate-500">No quotation files on requests this vendor won.</p>
            ) : (
              <ul className="space-y-2">
                {documents.map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => openDoc(d)}
                      className="focus-ring group flex w-full items-center gap-3 rounded-2xl bg-[var(--canvas)] px-4 py-3 text-left transition-colors hover:bg-[#ebe7e2]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--accent)]">
                        <FileText size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--ink)]">{d.file_name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {d.request?.request_number ?? 'Request'} · {format(new Date(d.uploaded_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <ArrowUpRight size={16} className="shrink-0 text-slate-400 transition-colors group-hover:text-[var(--ink)]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {editing && <VendorFormModal vendor={vendor} onClose={() => setEditing(false)} onSaved={setVendor} />}
    </div>
  )
}

function Meta({ label, icon: Icon, children }: { label: string; icon: typeof User; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon size={13} className="shrink-0" />
        {label}
      </p>
      <div className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">{children}</div>
    </div>
  )
}

function Stat({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div className={highlight ? 'min-w-0 rounded-[1.5rem] bg-[var(--sun)] p-5' : 'min-w-0 rounded-[1.5rem] bg-white p-5'}>
      <p className="text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="mt-2 truncate text-[clamp(1.5rem,3vw,2.1rem)] leading-none font-black tracking-tight text-[var(--ink)]">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-[var(--ink-soft)]">{hint}</p>}
    </div>
  )
}

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <h2 className="text-xl font-bold text-[var(--ink)]">{title}</h2>
      {count !== undefined && (
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--canvas)] px-2 text-xs font-medium text-[var(--ink)]">{count}</span>
      )}
    </div>
  )
}
