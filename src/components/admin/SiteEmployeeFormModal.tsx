import { useEffect, useState } from 'react'
import { HardHat } from 'lucide-react'
import { notify } from '@/lib/notify'
import { createSiteEmployee, fetchAllDepartments, updateSiteEmployee } from '@/services'
import type { Department, SiteEmployee } from '@/types'
import { Field, FormModal, Toggle } from './FormModal'

export function SiteEmployeeFormModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: SiteEmployee | null
  onClose: () => void
  onSaved: (employee: SiteEmployee) => void
}) {
  const [name, setName] = useState(employee?.full_name ?? '')
  const [department, setDepartment] = useState(employee?.department ?? '')
  const [notes, setNotes] = useState(employee?.notes ?? '')
  const [active, setActive] = useState(employee?.is_active ?? true)
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentsLoading, setDepartmentsLoading] = useState(true)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    let mounted = true
    fetchAllDepartments({ activeOnly: true }).then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        notify.error(`Could not load departments: ${error.message}`)
        setDepartmentsLoading(false)
        return
      }
      setDepartments(data ?? [])
      setDepartmentsLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  const errors = {
    name: touched && !name.trim() ? 'Required' : null,
    department: touched && !department ? 'Choose a department' : null,
  }

  async function submit() {
    setTouched(true)
    if (!name.trim() || !department) return false

    const input = {
      full_name: name.trim(),
      department,
      is_active: active,
      notes: notes.trim(),
    }
    const result = employee
      ? await updateSiteEmployee(employee.id, input)
      : await createSiteEmployee(input)

    if (result.error || !result.data) {
      notify.error(`Could not ${employee ? 'save' : 'add'} site employee: ${result.error?.message ?? 'unknown error'}`)
      return false
    }

    notify.success(employee ? 'Site employee saved' : 'Site employee added')
    onSaved(result.data)
    return true
  }

  return (
    <FormModal
      title={employee ? 'Edit site employee' : 'Add site employee'}
      description="Site employees are managed separately from login accounts."
      icon={HardHat}
      submitLabel={employee ? 'Save changes' : 'Add employee'}
      onSubmit={submit}
      onClose={onClose}
    >
      <Field label="Full name" htmlFor="se-name" error={errors.name}>
        <input
          id="se-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Amina Yusuf"
          autoComplete="off"
          className={errors.name ? 'field !border-[var(--accent)]' : 'field'}
        />
      </Field>
      <Field label="Department" htmlFor="se-department" error={errors.department}>
        <select
          id="se-department"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          disabled={departmentsLoading}
          className={errors.department ? 'field !border-[var(--accent)]' : 'field'}
        >
          <option value="">{departmentsLoading ? 'Loading departments…' : 'Select a department'}</option>
          {department && !departments.some((item) => item.name === department) && (
            <option value={department}>{department} (current)</option>
          )}
          {departments.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}{item.is_active ? '' : ' (Archived)'}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes" htmlFor="se-notes" hint="Optional">
        <textarea
          id="se-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Assigned to the east site"
          rows={3}
          className="field resize-y"
        />
      </Field>
      <Toggle checked={active} onChange={setActive} label="Active employee" description="Inactive employees remain in the site records." />
    </FormModal>
  )
}
