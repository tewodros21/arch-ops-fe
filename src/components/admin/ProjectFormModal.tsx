import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Check, FolderKanban } from 'lucide-react'
import { notify } from '@/lib/notify'
import { fetchTeamMembers, saveProject } from '@/services'
import type { Profile, Project } from '@/types'
import { Field, FormModal, Toggle } from './FormModal'

export function ProjectFormModal({ project, onClose, onSaved }: { project: Project | null; onClose: () => void; onSaved: (project: Project) => void }) {
  const [name, setName] = useState(project?.name ?? '')
  const [code, setCode] = useState(project?.code ?? '')
  const [client, setClient] = useState(project?.client_name ?? '')
  const [location, setLocation] = useState(project?.location ?? '')
  const [budget, setBudget] = useState(project?.budget != null ? String(project.budget) : '')
  const [active, setActive] = useState(project?.is_active ?? true)
  const [managerIds, setManagerIds] = useState<string[]>(project?.project_manager_ids ?? [])
  const [managers, setManagers] = useState<Profile[]>([])

  useEffect(() => {
    fetchTeamMembers().then((team) => setManagers(team.filter((u) => u.role === 'project_manager' && u.is_active)))
  }, [])
  const [touched, setTouched] = useState(false)

  const budgetNum = budget.trim() ? Number(budget) : null
  const errors = {
    name: touched && !name.trim() ? 'Required' : null,
    code: touched && !code.trim() ? 'Required' : null,
    budget: touched && budgetNum != null && (Number.isNaN(budgetNum) || budgetNum < 0) ? 'Enter a positive number' : null,
  }

  async function submit() {
    setTouched(true)
    if (!name.trim() || !code.trim() || (budgetNum != null && (Number.isNaN(budgetNum) || budgetNum < 0))) return false
    const row = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      client_name: client.trim() || null,
      location: location.trim() || null,
      budget: budgetNum,
      is_active: active,
      project_manager_ids: managerIds,
    }
    const { data, error } = await saveProject(row, project?.id)
    if (error || !data) {
      notify.error(error?.code === 'conflict' ? 'That project code is already used' : `Could not save project: ${error?.message ?? 'no permission'}`)
      return false
    }
    notify.success(project ? 'Project details saved' : 'Project created and ready for requests')
    // Keep the spend figure the list already showed
    onSaved({ ...data, spent_amount: data.spent_amount ?? project?.spent_amount })
    return true
  }

  return (
    <FormModal
      title={project ? 'Edit project' : 'New project'}
      description="Requests are raised against a project and tracked against its budget."
      icon={FolderKanban}
      submitLabel={project ? 'Save changes' : 'Create project'}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <Field label="Project name" htmlFor="pr-name" error={errors.name}>
          <input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Riverside Office Renovation" className={errors.name ? 'field !border-[var(--accent)]' : 'field'} />
        </Field>
        <Field label="Code" htmlFor="pr-code" error={errors.code}>
          <input id="pr-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="RVS-01" className={errors.code ? 'field uppercase !border-[var(--accent)]' : 'field uppercase'} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Client" htmlFor="pr-client" hint="Optional">
          <input id="pr-client" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" className="field" />
        </Field>
        <Field label="Location" htmlFor="pr-location" hint="Optional">
          <input id="pr-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Site address or city" className="field" />
        </Field>
      </div>
      <Field label="Budget (ETB)" htmlFor="pr-budget" hint="Optional" error={errors.budget}>
        <input
          id="pr-budget"
          type="number"
          min={0}
          inputMode="decimal"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="250000"
          className={errors.budget ? 'field !border-[var(--accent)]' : 'field'}
        />
      </Field>
      <Field label="Project Managers" hint="Any one of them can approve this project's requests">
        {managers.length === 0 ? (
          <p className="rounded-2xl bg-[var(--canvas)] px-4 py-3 text-sm text-slate-500">No active project managers yet. You can assign them later.</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Project Managers">
            {managers.map((m) => {
              const selected = managerIds.includes(m.id)
              const others = (m.assigned_project_ids ?? []).filter((id) => id !== project?.id).length
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setManagerIds((ids) => (selected ? ids.filter((id) => id !== m.id) : [...ids, m.id]))}
                  className={clsx(
                    'focus-ring flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                    selected ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-black/10 text-[var(--ink)] hover:border-black/30',
                  )}
                >
                  {selected && <Check size={14} />}
                  {m.full_name}
                  {others > 0 && <span className={selected ? 'text-white/70' : 'text-slate-400'}>· {others} other project{others === 1 ? '' : 's'}</span>}
                </button>
              )
            })}
          </div>
        )}
        {managers.length > 0 && managerIds.length === 0 && (
          <p className="mt-2 text-xs text-slate-500">No PM selected. Requests for this project can't be submitted until one is assigned.</p>
        )}
      </Field>
      <Toggle checked={active} onChange={setActive} label="Active project" description="Archived projects are hidden from new requests" />
    </FormModal>
  )
}
