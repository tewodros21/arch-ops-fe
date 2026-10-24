import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Mail, MapPin, Pencil, Phone, Plus, Store, User } from 'lucide-react'
import clsx from 'clsx'
import { Avatar, PageHeader } from '@/components/ui'
import { VendorFormModal } from '@/components/admin/VendorFormModal'
import { useAuth } from '@/context/AuthContext'
import { NEW_VENDOR_SEARCH, VENDOR_CREATED_EVENT } from '@/constants'
import { getInitials } from '@/utils'
import { fetchVendors, VENDOR_MANAGER_ROLES } from '@/services'
import type { Vendor } from '@/types'

export function Vendors() {
  const { profile } = useAuth()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [service, setService] = useState<string | null>(null)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const canManage = !!profile && VENDOR_MANAGER_ROLES.includes(profile.role)

  async function load() {
    const v = await fetchVendors()
    setVendors(v)
    setLoading(false)
  }

  useEffect(() => {
    load()
    window.addEventListener(VENDOR_CREATED_EVENT, load)
    return () => window.removeEventListener(VENDOR_CREATED_EVENT, load)
  }, [])

  function handleSaved(v: Vendor) {
    setVendors((list) => {
      const next = list.some((i) => i.id === v.id) ? list.map((i) => (i.id === v.id ? v : i)) : [...list, v]
      return next.sort((a, b) => a.name.localeCompare(b.name))
    })
  }

  const servicesOf = (v: Vendor) => (v.services ?? '').split(/,\s*/).filter(Boolean)
  const allServices = [...new Set(vendors.flatMap(servicesOf))].sort()
  const filtered = vendors.filter((v) => !service || servicesOf(v).includes(service))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendors"
        count={filtered.length}
        subtitle="Suppliers and contractors you can quote from"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button className="chip focus-ring" aria-pressed={service === null} onClick={() => setService(null)}>
          All
          <span className="text-xs opacity-60">{vendors.length}</span>
        </button>
        {allServices.map((sv) => (
          <button key={sv} className="chip focus-ring" aria-pressed={service === sv} onClick={() => setService(sv)}>
            {sv}
            <span className="text-xs opacity-60">{vendors.filter((v) => servicesOf(v).includes(sv)).length}</span>
          </button>
        ))}
      </div>

      {loading && <p className="py-16 text-center text-sm text-slate-500">Loading vendors…</p>}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[1.75rem] bg-white px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--canvas)] text-slate-400">
            <Store size={24} />
          </span>
          <p className="text-lg font-bold text-[var(--ink)]">No vendors found</p>
          {canManage && (
            <Link to={{ search: NEW_VENDOR_SEARCH }} className="focus-ring inline-flex h-11 items-center gap-2 rounded-full border border-black/15 px-5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--canvas)]">
              <Plus size={16} />
              Add the first vendor
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((v, i) => (
          <article
            key={v.id}
            className={clsx('group relative flex flex-col rounded-[1.5rem] bg-white p-5 transition-shadow hover:shadow-[0_18px_50px_-30px_rgba(24,20,18,0.45)]', v.is_active === false && 'opacity-70')}
          >
            <div className="flex items-center gap-3">
              <Avatar initials={getInitials(v.name)} index={i} size={46} />
              <div className="min-w-0 flex-1">
                {/* Stretched link: the whole card opens the vendor */}
                <Link to={`/vendors/${v.id}`} className="focus-ring rounded-md text-lg leading-tight font-bold text-[var(--ink)] after:absolute after:inset-0 after:rounded-[1.5rem]">
                  {v.name}
                </Link>
                {v.is_active === false && <p className="mt-0.5 text-xs font-medium text-slate-500">Inactive</p>}
              </div>
              {canManage ? (
                <button
                  onClick={() => setEditing(v)}
                  aria-label={`Edit ${v.name}`}
                  className="focus-ring relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 text-[var(--ink)] hover:bg-[var(--canvas)]"
                >
                  <Pencil size={15} />
                </button>
              ) : (
                <ArrowUpRight size={18} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              )}
            </div>
            {v.services && (
              <div className="mt-4 mb-4 flex flex-wrap gap-1.5">
                {servicesOf(v).map((s) => (
                  <span key={s} className="rounded-full bg-[var(--canvas)] px-2.5 py-1 text-xs text-[var(--ink)]">{s}</span>
                ))}
              </div>
            )}
            <div className="mt-auto space-y-1 border-t border-black/[0.06] pt-4 text-sm">
              {v.contact_person && (
                <p className="flex items-center gap-2.5 text-[var(--ink)]">
                  <User size={15} className="shrink-0 text-slate-400" />
                  {v.contact_person}
                </p>
              )}
              {v.phone && (
                <a href={`tel:${v.phone}`} className="relative z-10 flex w-fit items-center gap-2.5 text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  <Phone size={15} className="shrink-0 text-slate-400" />
                  {v.phone}
                </a>
              )}
              {v.email && (
                <a href={`mailto:${v.email}`} className="relative z-10 flex w-fit max-w-full min-w-0 items-center gap-2.5 text-[var(--ink-soft)] hover:text-[var(--accent)]">
                  <Mail size={15} className="shrink-0 text-slate-400" />
                  <span className="truncate">{v.email}</span>
                </a>
              )}
              {v.address && (
                <p className="flex min-w-0 items-center gap-2.5 text-[var(--ink-soft)]">
                  <MapPin size={15} className="shrink-0 text-slate-400" />
                  <span className="truncate">{v.address}</span>
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      {editing && <VendorFormModal vendor={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </div>
  )
}
