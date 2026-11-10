import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { HardHat, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SiteEmployeeFormModal } from '@/components/admin/SiteEmployeeFormModal'
import { useConfirm } from '@/components/ui'
import { NEW_SITE_EMPLOYEE_SEARCH, SITE_EMPLOYEE_CREATED_EVENT } from '@/constants'
import { notify } from '@/lib/notify'
import { deleteSiteEmployee, fetchSiteEmployees } from '@/services'
import type { SiteEmployee } from '@/types'
import { EmptyCard, ListCard } from './shared'

type StatusFilter = 'all' | 'active' | 'inactive'

const TEMPLATE = 'md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto_5rem]'

export function SiteEmployeesTab() {
  const confirm = useConfirm()
  const [employees, setEmployees] = useState<SiteEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [editing, setEditing] = useState<SiteEmployee | null>(null)

  async function load() {
    const { data, error } = await fetchSiteEmployees()
    if (error) notify.error(`Could not load site employees: ${error.message}`)
    setEmployees(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    fetchSiteEmployees().then(({ data, error }) => {
      if (!active) return
      if (error) notify.error(`Could not load site employees: ${error.message}`)
      setEmployees(data ?? [])
      setLoading(false)
    })
    window.addEventListener(SITE_EMPLOYEE_CREATED_EVENT, load)
    return () => {
      active = false
      window.removeEventListener(SITE_EMPLOYEE_CREATED_EVENT, load)
    }
  }, [])

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = employees.filter(
    (employee) =>
      (status === 'all' || employee.is_active === (status === 'active')) &&
      (!normalizedQuery ||
        employee.full_name.toLowerCase().includes(normalizedQuery) ||
        employee.department.toLowerCase().includes(normalizedQuery) ||
        employee.notes.toLowerCase().includes(normalizedQuery)),
  )

  function upsert(employee: SiteEmployee) {
    setEmployees((list) =>
      (list.some((item) => item.id === employee.id)
        ? list.map((item) => (item.id === employee.id ? employee : item))
        : [...list, employee]
      ).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    )
  }

  async function remove(employee: SiteEmployee) {
    const ok = await confirm({
      title: `Delete ${employee.full_name}?`,
      body: 'This removes the site employee record. It does not affect any login account.',
      confirmLabel: 'Delete employee',
      tone: 'danger',
      icon: Trash2,
    })
    if (!ok) return

    const { error } = await deleteSiteEmployee(employee.id)
    if (error) {
      notify.error(`Could not delete site employee: ${error.message}`)
      return
    }
    setEmployees((list) => list.filter((item) => item.id !== employee.id))
    notify.success('Site employee deleted')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="field flex h-11 items-center gap-2 !py-0 lg:w-72">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, department or notes"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0 lg:pb-0">
          {(['all', 'active', 'inactive'] as const).map((filter) => (
            <button
              key={filter}
              className="chip focus-ring whitespace-nowrap"
              aria-pressed={status === filter}
              onClick={() => setStatus(filter)}
            >
              {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Inactive'}
              <span className="text-xs opacity-60">
                {employees.filter((employee) => filter === 'all' || employee.is_active === (filter === 'active')).length}
              </span>
            </button>
          ))}
        </div>
        <Link
          to={{ search: NEW_SITE_EMPLOYEE_SEARCH }}
          className="focus-ring inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[var(--ink)] px-5 text-sm font-semibold text-white sm:self-auto lg:ml-auto"
        >
          <Plus size={16} />
          Add site employee
        </Link>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500">Loading site employees…</p>
      ) : filtered.length === 0 ? (
        <EmptyCard icon={HardHat} title={employees.length ? 'Nobody matches' : 'No site employees yet'} body={employees.length ? undefined : 'Add workers who do not need login accounts.'} />
      ) : (
        <ListCard columns={['Site employee', 'Department', 'Notes', 'Status', '']} template={TEMPLATE}>
          {filtered.map((employee) => (
            <li
              key={employee.id}
              className={clsx('flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-[var(--canvas)] md:grid md:gap-4', TEMPLATE)}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--canvas)] text-[var(--ink)]">
                  <HardHat size={17} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{employee.full_name}</p>
                  <p className="truncate text-xs text-slate-500 md:hidden">
                    {employee.department} · {employee.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
              <p className="hidden truncate text-sm text-[var(--ink-soft)] md:block">{employee.department}</p>
              <p className="hidden truncate text-sm text-[var(--ink-soft)] md:block" title={employee.notes}>{employee.notes || '—'}</p>
              <div className="hidden md:block">
                <SiteEmployeeStatus active={employee.is_active} />
              </div>
              <div className="flex shrink-0 justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditing(employee)}
                  aria-label={`Edit ${employee.full_name}`}
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-[var(--ink)] hover:bg-white"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(employee)}
                  aria-label={`Delete ${employee.full_name}`}
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ListCard>
      )}

      {editing && (
        <SiteEmployeeFormModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={(employee) => {
            upsert(employee)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function SiteEmployeeStatus({ active }: { active: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        active ? 'bg-[#d3efdf] text-[#1e8c66]' : 'bg-[var(--canvas)] text-slate-500',
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', active ? 'bg-[#1e8c66]' : 'bg-slate-400')} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}
