# Design Document

## Overview

Replaces the generic "Complete supplier details" link in the Review-step banner of `NewRequestModal` with an itemized list of missing requirements. Each item is a button that jumps to step 3, scrolls the exact target into view, and focuses it (inputs) or flashes a highlight (drop zone, payment-method selector). All work is inside `src/components/requests/NewRequestModal.tsx` plus a small id anchor on the existing `DropZone` label. No save/validation logic changes.

## Architecture

Single-component change:

```
Review step banner (step 4)
  └─ missingItems: computed list of { targetId, label }
       └─ onClick -> goToMissing(targetId)
            ├─ setStep(3)                      (navigate)
            ├─ after render: scrollIntoView    (locate)
            └─ focus() OR temporary highlight  (direct attention)
```

## Components and Interfaces

### 1. Missing-item computation (`NewRequestModal.tsx`)

Derive a list next to the existing `hasSupplierDetails` / `hasPaymentDetails` / `hasProformas` booleans, reusing the same data so the banner can never disagree with the submit-disabled condition:

```ts
interface MissingItem { targetId: string; label: string }
```

Built from the existing form state:

- Per selected project, when its supplier fields fail the `hasSupplierDetails` test individually:
  - `supplier_name` empty -> `{ targetId: "supplier-name-<projectId>", label: "Supplier name for <project.name>" }`
  - `supplier_address` empty -> `{ targetId: "supplier-address-<projectId>", label: "Supplier address for <project.name>" }`
  - `supplier_phone` empty -> `{ targetId: "supplier-phone-<projectId>", label: "Supplier phone for <project.name>" }`
- Per selected project with no Proforma (`!proformaFiles[id] && !existingProformas[id]`) -> `{ targetId: "proforma-<projectId>", label: "Proforma for <project.name>" }`
- Payment, mirroring `hasPaymentDetails` / `paymentError` logic:
  - no method -> `{ targetId: "payment-method", label: "Payment method" }`
  - method set but no account number on the primary account -> `{ targetId: "account-number-0", label: "Account number" }`
  - method is bank and bank name empty -> `{ targetId: "bank-name-0", label: "Bank name" }`

### 2. Target anchors (step 3)

Add stable `id` attributes where they do not exist yet:

- Supplier name input is the `SupplierNameField` input (it already accepts `id`; pass `supplier-name-<projectId>`). Address and phone inputs get ids directly.
- Payment method selector group wrapper gets `id="payment-method"`.
- Bank name / account number inputs get `bank-name-<index>` / `account-number-<index>`.
- The `DropZone` label gets an id via a new optional `id` prop on `DropZone` (`proforma-<projectId>`), plus `tabIndex={-1}` so `.focus()` works on the label for scrolling consistency.

### 3. Navigation helper (`NewRequestModal.tsx`)

```ts
function goToMissing(targetId: string) {
  setShowErrors(true)          // keep existing error styling consistent
  setStep(3)
  setHighlightId(targetId)     // new state: string | null
  window.setTimeout(() => {
    const el = document.getElementById(targetId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus({ preventScroll: true })
  }, 60)                       // lets step 3 mount first (steps render conditionally)
}
```

A `highlightId` state applies a temporary ring class (e.g. `ring-2 ring-[var(--accent)]`) to the non-input targets (payment method group, DropZone label); a `setTimeout` clears it after ~2 s. Inputs get real focus instead, so no ring is needed there. The timeout id is kept in a ref and cleared on rerun/unmount.

### 4. Banner content (step 4)

Replace the single generic link with:

- Lead sentence kept short: "Complete the following to submit:"
- A vertical list of buttons, one per `MissingItem`, styled like the existing underlined link, each calling `goToMissing(item.targetId)`.
- Trailing text preserved: "or save this as a draft for now."

The save-path warning in `save()` (`submitAfter && (!hasSupplierDetails || !hasPaymentDetails)` and the Proforma check) continues to land on step 3 as today; the itemized navigation lives on the Review banner (Requirement 2.5 is satisfied because the same banner/list is what the user interacts with after being sent to review).

## Data Models

No type or persisted-shape changes. `MissingItem` is a local view model.

## Error Handling

- Target id missing (e.g. project deselected between render and click): `getElementById` returns null, scroll/focus are no-ops; the step still navigates.
- Highlight timer: cleared on unmount and before re-triggering to avoid stacking.

## Testing Strategy

No unit-test runner in this project. Verification:

1. `npm run lint` clean.
2. `npm run build` (`tsc -b && vite build`) passes.
3. Static checklist (task 2): with a fresh request, every missing-item kind appears in the banner; clicking each navigates to step 3 and targets the right element id; complete forms show the ready-to-submit panel; draft save unchanged.

## Correctness Properties

Properties are verified statically and via the manual checklist (no property-test runner exists).

### Property 1: Banner list matches the submit gate
For any form state, the banner renders if and only if `!hasSupplierDetails || !hasPaymentDetails || !hasProformas`, and every listed item corresponds to a concrete failing condition.

**Validates: Requirements 1.1, 1.5, 3.2**

### Property 2: Every missing field is reachable
For any listed missing item, an element with its `targetId` exists on step 3 when the item's project is selected.

**Validates: Requirements 2.1, 2.2**

### Property 3: Inputs receive focus, non-inputs receive highlight
For any clicked item, focus lands on the element when it is a focusable input; otherwise a temporary highlight is applied and cleared.

**Validates: Requirements 2.3, 2.4**

### Property 4: Completed items never appear
For any project whose supplier fields and Proforma are complete, no missing item for that project is listed.

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 5: Existing flows untouched
For any form state, draft save and submit behave exactly as before this change.

**Validates: Requirements 2.6, 3.1**
