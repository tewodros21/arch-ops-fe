# Implementation Plan

## Overview

Makes the Review-step incomplete banner in the purchase request form actionable: it itemizes each missing field/document and clicking an item navigates to step 3, scrolls the exact target into view, and focuses or highlights it.

## Task Dependency Graph

- Task 1 (implement itemized banner + navigation): no dependencies
- Task 2 (verification): depends on Task 1

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] }
  ]
}
```

## Tasks

- [x] 1. Implement itemized missing-item banner with click-through navigation
  - In `src/components/requests/NewRequestModal.tsx`, compute a `missingItems` list (`{ targetId, label }[]`) from the same state behind `hasSupplierDetails` / `hasPaymentDetails` / `hasProformas`: per-project supplier name/address/phone gaps, per-project Proforma gaps, and payment method / account number / bank name gaps (design.md section 1)
  - Add stable element ids on step 3: pass `id={`supplier-name-${project.id}`}` to `SupplierNameField`; add ids to the supplier address/phone inputs, the payment-method group wrapper, and the bank-name/account-number inputs (design.md section 2)
  - Add an optional `id` prop to the local `DropZone` component, put it (plus `tabIndex={-1}`) on its label, and pass `proforma-<projectId>` at the call site
  - Add `goToMissing(targetId)` (design.md section 3): setShowErrors(true), setStep(3), deferred scrollIntoView + focus, and a temporary `highlightId` ring for non-input targets cleared after ~2 s (timer kept in a ref, cleared on rerun/unmount)
  - Rewrite the step-4 banner (design.md section 4): lead line "Complete the following to submit:", a list of buttons (one per missing item) calling `goToMissing`, keep the "or save this as a draft for now." trailing text; do not touch save/submit/validation logic or the ready-to-submit panel
  - Verify with `npm run lint` and `npm run build`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3_

- [x] 2. Verification
  - Run `npm run lint` and `npm run build`; both must pass clean (pre-existing warnings in unrelated files are acceptable)
  - Statically walk the smoke checklist from design.md against the code: each missing-item kind renders in the banner with the right label; each `targetId` has a matching element id on step 3; complete forms show the ready-to-submit panel; draft save and submit-disabled logic unchanged; report PASS/FAIL per item with code evidence and fix any FAIL
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2_

## Notes

- Single-file change (`NewRequestModal.tsx`) plus the local `DropZone` id prop; no API or type changes.
- Steps render conditionally, so the scroll/focus must be deferred until after step 3 mounts.
- No unit-test runner exists; verification is lint + build + static checklist.
