import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { FolderKanban, MapPin, Pencil, Trash2 } from 'lucide-react'
import { useConfirm } from '@/components/ui'
import { ProjectFormModal } from '@/components/admin/ProjectFormModal'
import { PROJECT_CREATED_EVENT } from '@/constants'
import { notify } from '@/lib/notify'
import { deleteProject, fetchAllProjects } from '@/services'
import type { Project } from '@/types'
import { ActivePill, EmptyCard, ListCard } from './shared'

const TEMPLATE = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.8fr)_6rem_5rem]'
const money = (n: number) => `$${Math.round(n).toLocaleString()}`

export function ProjectsTab() {
  const confirm = useConfirm()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)

  async function load() {
    // spent_amount: approved money, replaced by the paid amount once known
    const { data, error } = await fetchAllProjects({ withSpend: true })
    if (error) notify.error('Could not load projects')
    setProjects(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    window.addEventListener(PROJECT_CREATED_EVENT, load)
    return () => window.removeEventListener(PROJECT_CREATED_EVENT, load)
  }, [])

  function upsert(p: Project) {
    setProjects((list) => (list.some((i) => i.id === p.id) ? list.map((i) => (i.id === p.id ? p : i)) : [...list, p]).sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function remove(p: Project) {
    const ok = await confirm({
      title: `Delete ${p.name}?`,
      body: 'Projects with purchase or labor requests cannot be deleted. Archive those instead so history stays intact.',
      confirmLabel: 'Delete project',
      tone: 'danger',
      icon: Trash2,
    })
    if (!ok) return
    const { error } = await deleteProject(p.id)
    if (error) {
      notify.error(error.code === 'in_use' ? 'Project has requests, archive it instead' : `Could not delete project: ${error.message}`)
      return
    }
    setProjects((list) => list.filter((i) => i.id !== p.id))
    notify.success('Project deleted')
  }

  const archived = projects.filter((p) => !p.is_active).length
  const visible = projects.filter((p) => showArchived || p.is_active)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <button className="chip focus-ring" aria-pressed={!showArchived} onClick={() => setShowArchived(false)}>
            Active <span className="text-xs opacity-60">{projects.length - archived}</span>
          </button>
          <button className="chip focus-ring" aria-pressed={showArchived} onClick={() => setShowArchived(true)}>
            All <span className="text-xs opacity-60">{projects.length}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500">Loading projects…</p>
      ) : visible.length === 0 ? (
        <EmptyCard icon={FolderKanban} title="No projects yet" body="Requests are raised against a project, so add one first." />
      ) : (
        <ListCard columns={['Project', 'Spend vs budget', 'Status', '']} template={TEMPLATE}>
          {visible.map((p) => {
            const spent = Number(p.spent_amount ?? 0)
            const budget = Number(p.budget ?? 0)
            const pct = budget > 0 ? (spent / budget) * 100 : 0
            const over = budget > 0 && spent > budget
            return (
              <li key={p.id} className={clsx('grid grid-cols-1 gap-3 rounded-2xl px-3 py-3.5 transition-colors hover:bg-[var(--canvas)] md:items-center md:gap-4', TEMPLATE)}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--ink)] px-2.5 py-0.5 text-[11px] font-semibold text-white">{p.code}</span>
                      <span className="md:hidden">
                        <ActivePill active={p.is_active} />
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-sm font-semibold text-[var(--ink)]">{p.name}</p>
                    <p className="flex min-w-0 items-center gap-1 truncate text-xs text-slate-500">
                      {p.client_name || 'No client'}
                      {p.location && (
                        <>
                          <span>·</span>
                          <MapPin size={12} className="shrink-0" />
                          <span className="truncate">{p.location}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-semibold text-[var(--ink)]">{money(spent)}</span>
                    <span className={clsx(over ? 'font-semibold text-[var(--accent)]' : 'text-slate-500')}>
                      {budget > 0 ? `${Math.round(pct)}% of ${money(budget)}` : 'No budget set'}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--canvas)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${budget > 0 ? Math.min(100, pct) : 0}%`,
                        background: over ? 'var(--accent)' : pct > 80 ? 'var(--sun)' : 'var(--ink)',
                      }}
                    />
                  </div>
                </div>

                <div className="hidden md:block">
                  <ActivePill active={p.is_active} />
                </div>

                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => setEditing(p)}
                    aria-label={`Edit ${p.name}`}
                    className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-[var(--ink)] hover:bg-white"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => remove(p)}
                    aria-label={`Delete ${p.name}`}
                    className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            )
          })}
        </ListCard>
      )}

      {editing && <ProjectFormModal project={editing} onClose={() => setEditing(null)} onSaved={upsert} />}
    </div>
  )
}
