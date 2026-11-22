# Design Document

## Overview

This feature connects the purchase request form to the backend's new supplier-suggestions endpoint so requesters can reuse supplier details from past requests. Work happens in four places, following the codebase's layering (UI -> `src/services` -> `src/api` contract -> HTTP):

1. A typed `SupplierSuggestion` read model and a `supplierSuggestions` method on the `backend` API contract.
2. A `fetchSupplierSuggestions` service function.
3. A reusable `SupplierNameField` combobox component, integrated into each project's supplier block in `NewRequestModal`.
4. A one-line role-list correction removing `finance` from `PURCHASE_REQUESTER_ROLES`.

The backend endpoint (`GET /purchase-requests/supplier-suggestions/?q=<text>`) is live: it returns at most 10 suppliers ordered by most recent usage, accessible only to `admin`, `ceo`, `project_manager`, and `site_engineer`. No request-creation behavior changes; free-text suppliers keep working exactly as today.

## Architecture

```
NewRequestModal (step 3, per-project supplier block)
  └─ SupplierNameField (combobox: debounce, dropdown, keyboard nav)
       └─ fetchSupplierSuggestions (src/services/requests.ts)
            └─ backend.purchases.supplierSuggestions (src/api/types.ts contract)
                 └─ django.ts: GET /purchase-requests/supplier-suggestions/?q=
```

Selection flows back up: `SupplierNameField` raises `onSelect(suggestion)`; `NewRequestModal` applies the suggestion to that project's supplier block and to the request-level payment method/accounts.

## Components and Interfaces

### 1. Read model (`src/types/index.ts`)

Added near `PurchaseDuplicate` (existing read-model pattern):

```ts
export interface SupplierSuggestion {
  supplier_name: string
  supplier_address: string
  supplier_phone: string
  payment_method: SupplierPaymentMethod | ''
  payment_accounts: SupplierPaymentAccount[]
}
```

The backend response mirrors this shape verbatim; no mapping is needed. `SupplierPaymentAccount` and `SupplierPaymentMethod` already exist.

### 2. API contract (`src/api/types.ts`, `src/api/django.ts`)

`Backend.purchases` gains:

```ts
/** Suppliers from past requests matching the query (requester roles only) */
supplierSuggestions(query: string): Promise<Result<SupplierSuggestion[]>>
```

Django implementation, following the `checkDuplicates` pattern:

```ts
async supplierSuggestions(query) {
  const { data, error } = await http.get<SupplierSuggestion[]>('/purchase-requests/supplier-suggestions/', { q: query })
  return error || !data ? { data: null, error } : { data, error: null }
}
```

`http.get` already accepts a params object as its second argument (see `purchases.list`).

### 3. Service (`src/services/requests.ts`)

```ts
export async function fetchSupplierSuggestions(query: string): Promise<SupplierSuggestion[]>
```

Mirrors `fetchActiveVendors`: on error, `console.error` and return `[]`. Silent by design (Requirement 1.3): autocomplete is an aid, never a blocker.

### 4. `SupplierNameField` component (new: `src/components/requests/SupplierNameField.tsx`)

Props:

```ts
{
  id?: string
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: SupplierSuggestion) => void
  placeholder?: string
  'aria-label'?: string
}
```

Behavior:

- Internal state: `options`, `open`, `highlighted` index, and a debounce timer ref.
- On `value` change: if trimmed length < 2, close and clear; otherwise fetch after a 350 ms debounce (same constant the modal uses for duplicate checks).
- Stale-response guard: an `active` flag plus latest-query comparison, matching the existing duplicate-check effect pattern in `NewRequestModal`.
- Dropdown: absolutely positioned list under the input, styled with the existing card/border tokens; each row shows `supplier_name` (primary) and `supplier_address` (secondary, truncated).
- ARIA: input gets `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; list gets `role="listbox"`; rows get `role="option"` with `aria-selected`.
- Keyboard: ArrowDown/ArrowUp move the highlight, Enter selects the highlighted option (preventDefault so the surrounding form/modal does not submit), Escape closes.
- Pointer: `onMouseDown` on a row selects before input blur closes the dropdown; blur closes.
- Selection calls `onSelect(option)` (parent decides what to prefill) and closes.

### 5. `NewRequestModal` integration (`src/components/requests/NewRequestModal.tsx`)

- The `supplier_name` input inside each project's supplier block (step 3) is replaced by `SupplierNameField`, keeping the existing `updateSupplier(project.id, 'supplier_name', ...)` wiring for `onChange`.
- New `applySupplierSuggestion(projectId: string, suggestion: SupplierSuggestion)`:
  - `updateSupplier(projectId, ...)` for `supplier_name`, `supplier_address`, `supplier_phone` (that project only).
  - If `suggestion.payment_method` is set, set form-level `supplier_payment_method`.
  - If `suggestion.payment_accounts.length > 0`, replace form-level `payment_accounts` with the suggestion's accounts (mapped onto `SupplierPaymentAccount`); if the method is `'telebirr'`, keep only the first account (existing form rule).
  - Mark the form dirty (`setTouched(true)`), consistent with other edits.
- Design decision (documented for reviewers): payment method and accounts are request-level in this form, so a suggestion applied to any one project's block replaces the shared payment set. This matches how the form already works for manual entry and keeps per-project supplier identity (name/address/phone) independent.

### 6. Role correction (`src/lib/workflow.ts`)

Remove `'finance'` from `PURCHASE_REQUESTER_ROLES`. All consumers (`nav.ts`, `RequestList.tsx`, `DashboardLayout.tsx`) read through `canCreatePurchaseRequest`, so the button and modal disappear for finance users without further changes.

## Data Models

Only the `SupplierSuggestion` read model above is new. No changes to `RequestInput`, `PurchaseRequest`, or any persisted shape.

## Error Handling

| Failure | Behavior |
| --- | --- |
| Endpoint 403 (finance/shopkeeper) | Unreachable in practice (those roles never see the form); if hit, service returns `[]` and logs |
| Network/server error | Service returns `[]`, logs; form stays fully usable, no toast |
| Empty/short query | No fetch; dropdown closed |
| Stale response | Discarded via active-flag/latest-query guard |

## Testing Strategy

The project has no unit-test runner (no vitest/jest in `package.json`); verification is static plus manual:

1. `npm run lint` (oxlint) — clean.
2. `npm run build` (`tsc -b && vite build`) — passes; the typed contract catches integration drift.
3. Manual smoke checklist (executed in task 5):
   - Type a partial supplier name -> dropdown with name + address appears.
   - Select a suggestion -> block fields and payment accounts prefill; form marked dirty.
   - Type a brand-new supplier -> no dropdown, free text saves normally.
   - Arrow keys + Enter select; Escape closes; clicking elsewhere closes.
   - With two projects selected, a suggestion applied to project B does not alter project A's block.
   - Signed in as finance: no "New request" action anywhere.

## Correctness Properties

This project has no property-based test runner, so the properties below are verified by typecheck, lint, build, and the manual checklist in Task 5 rather than automated generators.

### Property 1: Short queries never fetch
For any query shorter than 2 characters, no network request is issued and the dropdown stays closed.

**Validates: Requirements 2.1, 2.3**

### Property 2: One in-flight request per debounce
For any query of 2 or more characters, exactly one request is in flight after the debounce, and stale responses never overwrite newer results.

**Validates: Requirements 2.1, 2.10**

### Property 3: Project isolation on prefill
For any selected suggestion, only the targeted project's supplier block changes (name/address/phone); other projects' blocks are untouched.

**Validates: Requirements 2.4, 2.9**

### Property 4: Payment prefill mirrors the suggestion
For any suggestion with payment accounts, the request-level payment method and accounts reflect the suggestion after selection (first account only for `telebirr`).

**Validates: Requirements 2.5**

### Property 5: Free text survives
For any typed value never matched to a suggestion, the value persists unchanged through save.

**Validates: Requirements 2.6**

### Property 6: Failures are silent
For any endpoint failure, the form remains fully usable and no error toast is shown.

**Validates: Requirements 1.3, 2.7**

### Property 7: Finance never sees creation entry points
For any finance-role profile, no purchase-request creation action renders in navigation, the request list, or the dashboard layout.

**Validates: Requirements 3.1, 3.2**


