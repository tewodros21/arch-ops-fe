import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { notify } from '@/lib/notify'
import { saveDepartment } from '@/services'
import type { Department } from '@/types'
import { Field, FormModal, Toggle } from './FormModal'

export function DepartmentFormModal({ department, onClose, onSaved }: { department: Department | null; onClose: () => void; onSaved: (department: Department) => void }) {
  const [name, setName] = useState(department?.name ?? '')
  const [active, setActive] = useState(department?.is_active ?? true)
  const [touched, setTouched] = useState(false)
  const nameError = touched && !name.trim() ? 'Required' : null
  const renamed = !!department && name.trim() !== department.name

  async function submit() {
    setTouched(true)
    if (!name.trim()) return false
    const row = { name: name.trim(), is_active: active }
    const { data, error } = await saveDepartment(row, department?.id)
    if (error || !data) {
      notify.error(error?.code === 'conflict' ? 'A department with that name exists' : `Could not save department: ${error?.message ?? 'no permission'}`)
      return false
    }
    notify.success(department ? 'Department saved' : 'Department added')
    // People stay under the old name after a rename, so the new name starts empty
    onSaved({ ...data, member_count: data.member_count ?? (renamed ? 0 : (department?.member_count ?? 0)) })
    return true
  }

  return (
    <FormModal
      title={department ? 'Edit department' : 'New department'}
      description="People and purchase requests are grouped by department."
      icon={Building2}
      submitLabel={department ? 'Save changes' : 'Add department'}
      onSubmit={submit}
      onClose={onClose}
    >
      <Field label="Name" htmlFor="d-name" error={nameError}>
        <input id="d-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Architecture" className={nameError ? 'field !border-[var(--accent)]' : 'field'} />
      </Field>
      {renamed && (
        <p className="rounded-2xl bg-[var(--sun-soft)] px-4 py-3 text-xs leading-relaxed text-[var(--ink)]">
          People and past requests keep the old name. Move people over from the Users tab.
        </p>
      )}
      <Toggle checked={active} onChange={setActive} label="Active department" description="Archived departments can't be picked for people" />
    </FormModal>
  )
}
