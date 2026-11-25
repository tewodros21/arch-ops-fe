# Implementation Plan

## Overview

Adds supplier-name autocomplete to the purchase request form (backed by the live `GET /purchase-requests/supplier-suggestions/` endpoint), prefills supplier and payment details on selection, and removes `finance` from the frontend purchase-requester role list.

## Task Dependency Graph

- Task 1 (type + API + service): no dependencies
- Task 2 (SupplierNameField component): depends on Task 1
- Task 3 (NewRequestModal integration): depends on Task 2
- Task 4 (finance role fix): no dependencies; may run in parallel with Tasks 1-3
- Task 5 (final verification): depends on Tasks 1, 2, 3, 4

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "4"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["5"] }
  ]
}
```

## Tasks

- [x] 1. Add supplier suggestion type, API contract method, and service function
  - Add `SupplierSuggestion` to `src/types/index.ts` (near `PurchaseDuplicate`), reusing `SupplierPaymentMethod` and `SupplierPaymentAccount`
  - Add `supplierSuggestions(query)` to `Backend.purchases` in `src/api/types.ts` and implement it in `src/api/django.ts` (`GET /purchase-requests/supplier-suggestions/` with `{ q: query }`, following the `checkDuplicates` pattern)
  - Add `fetchSupplierSuggestions(query)` to `src/services/requests.ts` (returns `SupplierSuggestion[]`; logs and returns `[]` on error, like `fetchActiveVendors`)
  - Verify with `npm run lint` and `npm run build`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Build the `SupplierNameField` combobox component
  - Create `src/components/requests/SupplierNameField.tsx` per design section 4: debounced (350 ms) fetch when trimmed value has at least 2 characters, stale-response guard, dropdown rows showing `supplier_name` + `supplier_address`
  - Keyboard support: ArrowDown/ArrowUp to move, Enter to select (preventDefault), Escape to close; pointer select via `onMouseDown`; blur closes
  - ARIA: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `role="listbox"`, `role="option"` with `aria-selected`
  - Style with existing input/card tokens so it blends into the modal
  - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 2.8, 2.10_

- [x] 3. Integrate suggestions into `NewRequestModal` supplier blocks
  - Replace the `supplier_name` input in each project's supplier block (step 3) with `SupplierNameField`, keeping `updateSupplier(project.id, 'supplier_name', ...)` as `onChange`
  - Add `applySupplierSuggestion(projectId, suggestion)`: prefills that block's name/address/phone; sets form-level `supplier_payment_method` when present; replaces form-level `payment_accounts` when the suggestion has accounts (first account only when method is `telebirr`); calls `setTouched(true)`
  - Verify multi-project behavior: applying a suggestion to one project leaves other projects' blocks untouched
  - Verify with `npm run lint` and `npm run build`
  - _Requirements: 2.4, 2.5, 2.9_

- [x] 4. Remove finance from purchase requester roles
  - Remove `'finance'` from `PURCHASE_REQUESTER_ROLES` in `src/lib/workflow.ts`
  - Confirm `canCreatePurchaseRequest` consumers (`nav.ts`, `RequestList.tsx`, `DashboardLayout.tsx`) need no further changes
  - Verify with `npm run lint` and `npm run build`
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. Final verification
  - Run `npm run lint` and `npm run build`; both must pass clean
  - Walk the manual smoke checklist from the design doc (suggestion dropdown, prefill, free-text path, keyboard, multi-project isolation, finance sees no New request action) and report results
  - _Requirements: 1.1, 2.1, 2.4, 2.5, 2.6, 2.8, 2.9, 3.1, 3.2_

## Notes

- Backend endpoint is already live; roles allowed: `admin`, `ceo`, `project_manager`, `site_engineer` (403 otherwise).
- No unit-test runner exists in this project; verification is lint + build + manual checklist.
- Duplicate supplier spellings are intentionally out of scope for v1 (product decision).

