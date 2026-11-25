# Requirements Document

## Introduction

When creating a purchase request, requesters currently type supplier details (name, address, phone, payment method, payment accounts) by hand every time, even when the same supplier has been used on many past requests. The backend now exposes `GET /purchase-requests/supplier-suggestions/?q=<text>`, which searches request history and returns up to 10 previously used suppliers with their most recent details (name, address, phone, payment method, and payment accounts). This feature adds autocomplete suggestions to the supplier name field in the purchase request form so requesters can pick a past supplier and have the details prefilled, while keeping free-text entry for new suppliers. It also corrects the frontend role list so finance users are no longer offered a purchase-request form the server will reject.

## Glossary

- **Requester**: a signed-in user whose role may create purchase requests: `admin`, `ceo`, `project_manager`, or `site_engineer`.
- **Suggestion**: a supplier record returned by the supplier-suggestions endpoint, built from past purchase requests.
- **Supplier block**: the per-project supplier fields (name, address, contact phone) in step 3 of `NewRequestModal`.
- **Payment accounts**: the request-level list of supplier payment accounts (bank name, account number, account holder, phone) collected in the same step.

## Requirements

### Requirement 1: Supplier suggestion data access

**User Story:** As a frontend developer, I want a typed service that queries the supplier suggestions endpoint, so that UI components can fetch suggestions without knowing HTTP details.

#### Acceptance Criteria

1. WHEN a caller invokes the supplier suggestion service with a query string THEN the system SHALL call `GET /purchase-requests/supplier-suggestions/` with the query as the `q` parameter.
2. WHEN the endpoint returns results THEN the system SHALL return them as typed records containing `supplier_name`, `supplier_address`, `supplier_phone`, `payment_method`, and `payment_accounts`.
3. IF the endpoint call fails THEN the system SHALL return an empty result and log the error, without surfacing a notification to the user.
4. The system SHALL expose the endpoint through the existing `backend` API contract (declared in `src/api/types.ts`, implemented in `src/api/django.ts`), consistent with the codebase's data-access layering (UI never calls HTTP directly).

### Requirement 2: Supplier name autocomplete in the purchase request form

**User Story:** As a requester, I want supplier name suggestions as I type in the purchase request form, so that I can reuse an existing supplier's details instead of retyping them.

#### Acceptance Criteria

1. WHEN a Requester types at least 2 characters into a supplier name field THEN the system SHALL query suggestions after a debounce of about 350 ms.
2. WHEN matching suggestions exist THEN the system SHALL display a dropdown listing each Suggestion's `supplier_name` and `supplier_address`.
3. WHEN no suggestions match, or the query is shorter than 2 characters THEN the system SHALL NOT display the dropdown.
4. WHEN a Requester selects a Suggestion for a project's Supplier block THEN the system SHALL prefill that block's `supplier_name`, `supplier_address`, and `supplier_phone` from the Suggestion.
5. WHEN a Requester selects a Suggestion that includes a payment method or payment accounts THEN the system SHALL set the request-level payment method and replace the request-level Payment accounts with the Suggestion's.
6. The system SHALL allow free-text supplier entry; selecting a Suggestion SHALL remain optional, and typed text SHALL be preserved unchanged when no Suggestion is selected.
7. WHEN the suggestion request fails THEN the system SHALL leave the form fully usable for free-text entry and SHALL NOT show an error notification.
8. The system SHALL support keyboard navigation in the dropdown (arrow keys to move, Enter to select, Escape to close) and expose appropriate ARIA combobox/listbox semantics.
9. WHEN the supplier name field belongs to one of several selected projects THEN the system SHALL apply the selected Suggestion's name, address, and phone only to that project's Supplier block.
10. WHEN the query changes while a suggestion request is in flight THEN the system SHALL ignore the stale response.

### Requirement 3: Purchase request creation role list correction

**User Story:** As a finance user, I want the app to not offer me a purchase request form, so that I never fill out a form the server will reject.

#### Acceptance Criteria

1. The system SHALL NOT include the `finance` role in the set of roles allowed to create purchase requests (`PURCHASE_REQUESTER_ROLES` / `canCreatePurchaseRequest` in `src/lib/workflow.ts`).
2. WHEN a finance user views the navigation or the request list THEN the system SHALL NOT present the "New request" action.
3. The system SHALL continue to allow `admin`, `ceo`, `project_manager`, and `site_engineer` to create purchase requests.

