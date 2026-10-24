import { useState } from 'react'
import { Store } from 'lucide-react'
import { notify } from '@/lib/notify'
import { saveVendor } from '@/services/vendors'
import type { Vendor } from '@/types'
import { Field, FormModal, Toggle } from './FormModal'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Add or edit a supplier. Services are stored as a comma separated list.
export function VendorFormModal({ vendor, onClose, onSaved }: { vendor?: Vendor | null; onClose: () => void; onSaved: (v: Vendor) => void }) {
  const [name, setName] = useState(vendor?.name ?? '')
  const [contact, setContact] = useState(vendor?.contact_person ?? '')
  const [phone, setPhone] = useState(vendor?.phone ?? '')
  const [email, setEmail] = useState(vendor?.email ?? '')
  const [address, setAddress] = useState(vendor?.address ?? '')
  const [services, setServices] = useState(vendor?.services ?? '')
  const [active, setActive] = useState(vendor?.is_active ?? true)
  const [touched, setTouched] = useState(false)

  const nameError = touched && !name.trim() ? 'Required' : null
  const emailError = touched && email.trim() && !EMAIL_RE.test(email.trim()) ? 'Check the address' : null

  async function submit() {
    setTouched(true)
    if (!name.trim() || (email.trim() && !EMAIL_RE.test(email.trim()))) return false
    const cleanServices = services
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ')
    const { data, error } = await saveVendor(
      {
        name: name.trim(),
        contact_person: contact.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        services: cleanServices || null,
        is_active: active,
      },
      vendor?.id,
    )
    if (error || !data) {
      notify.error(`Could not save vendor: ${error ?? 'unknown error'}`)
      return false
    }
    notify.success(vendor ? 'Vendor details updated' : 'Vendor added to your list')
    onSaved(data)
    return true
  }

  return (
    <FormModal
      title={vendor ? 'Edit vendor' : 'Add a vendor'}
      description={vendor ? 'Changes show up on every request that quotes them.' : 'Suppliers and contractors your team can quote from.'}
      icon={Store}
      submitLabel={vendor ? 'Save changes' : 'Add vendor'}
      onSubmit={submit}
      onClose={onClose}
    >
      <Field label="Company name" htmlFor="v-name" error={nameError}>
        <input id="v-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Addis Steel Works" className={nameError ? 'field !border-[var(--accent)]' : 'field'} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Contact person" htmlFor="v-contact" hint="Optional">
          <input id="v-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Full name" className="field" />
        </Field>
        <Field label="Phone" htmlFor="v-phone" hint="Optional">
          <input id="v-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251 …" className="field" />
        </Field>
      </div>
      <Field label="Email" htmlFor="v-email" hint="Optional" error={emailError}>
        <input id="v-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sales@vendor.com" className={emailError ? 'field !border-[var(--accent)]' : 'field'} />
      </Field>
      <Field label="Address" htmlFor="v-address" hint="Optional">
        <input id="v-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" className="field" />
      </Field>
      <Field label="Services" htmlFor="v-services" hint="Comma separated">
        <input id="v-services" value={services} onChange={(e) => setServices(e.target.value)} placeholder="Steel, Cladding, Delivery" className="field" />
      </Field>
      <Toggle checked={active} onChange={setActive} label="Active vendor" description="Inactive vendors stay in history but are flagged" />
    </FormModal>
  )
}
