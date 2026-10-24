import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Building2, Pencil, Trash2 } from 'lucide-react'
import { useConfirm } from '@/components/ui'
import { DepartmentFormModal } from '@/components/admin/DepartmentFormModal'
import { DEPARTMENT_CREATED_EVENT } from '@/constants'
import { notify } from '@/lib/notify'
import { deleteDepartment, fetchAllDepartments } from '@/services'
import type { Department } from '@/types'
import { ActivePill, EmptyCard, ListCard } from './shared'

const TEMPLATE = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_6rem_5rem]'

export function DepartmentsTab() {
  const confirm = useConfirm()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Department | null>(null)

  async function load() {
    const { data, error } = await fetchAllDepartments({ withMemberCount: true })
    if (error) notify.error('Could not load departments')
    setDepartments(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    window.addEventListener(DEPARTMENT_CREATED_EVENT, load)
    return () => window.removeEventListener(DEPARTMENT_CREATED_EVENT, load)
  }, [])

  function upsert(d: Department) {
    setDepartments((list) => (list.some((i) => i.id === d.id) ? list.map((i) => (i.id === d.id ? d : i)) : [...list, d]).sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function remove(d: Department) {
    const count = d.member_count ?? 0
    const ok = await confirm({
      title: `Delete ${d.name}?`,
      body: count
        ? `${count} ${count === 1 ? 'person is' : 'people are'} still in this department. They keep the name until you move them, so archiving is usually safer.`
        : 'Past requests keep their department name. This only removes it from the list.',
      confirmLabel: 'Delete department',
      tone: 'danger',
      icon: Trash2,
    })
    if (!ok) return
    const { error } = await deleteDepartment(d.id)
    if (error) {
      notify.error(`Could not delete department: ${error.message}`)
      return
    }
    setDepartments((list) => list.filter((i) => i.id !== d.id))
    notify.success('Department deleted')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="px-1 text-sm text-[var(--ink-soft)]">
          {departments.filter((d) => d.is_active).length} active of {departments.length}
        </p>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500">Loading departments…</p>
      ) : departments.length === 0 ? (
        <EmptyCard icon={Building2} title="No departments yet" body="Add the teams your people and requests belong to." />
      ) : (
        <ListCard columns={['Department', 'People', 'Status', '']} template={TEMPLATE}>
          {departments.map((d) => (
            <li key={d.id} className={clsx('flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-[var(--canvas)] md:grid md:gap-4', TEMPLATE)}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--canvas)] text-[var(--ink)]">
                  <Building2 size={17} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{d.name}</p>
                  <p className="text-xs text-slate-500 md:hidden">
                    {d.member_count ?? 0} people · {d.is_active ? 'Active' : 'Archived'}
                  </p>
                </div>
              </div>
              <p className="hidden text-sm text-[var(--ink-soft)] md:block">{d.member_count ?? 0}</p>
              <div className="hidden md:block">
                <ActivePill active={d.is_active} />
              </div>
              <div className="flex shrink-0 justify-end gap-1.5">
                <button
                  onClick={() => setEditing(d)}
                  aria-label={`Edit ${d.name}`}
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-[var(--ink)] hover:bg-white"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => remove(d)}
                  aria-label={`Delete ${d.name}`}
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ListCard>
      )}

      {editing && <DepartmentFormModal department={editing} onClose={() => setEditing(null)} onSaved={upsert} />}
    </div>
  )
}
