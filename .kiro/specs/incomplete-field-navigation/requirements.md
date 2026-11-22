# Requirements Document

## Introduction

On the Review step of the purchase request form (`NewRequestModal`), an informational banner appears when supplier details, payment details, or a Proforma are incomplete: "Complete each project's supplier, contact, payment details, and upload its Proforma to submit." Today its only action is a generic "Complete supplier details" link that jumps to the Supplier & Proforma step without indicating what is missing. Since all three incomplete types live on that same step (spread across multiple project blocks), the requester has to hunt for the gap. This enhancement makes the banner itemize exactly what is missing and turns each item into a link that navigates to the step, scrolls the specific field into view, and focuses or highlights it.

## Glossary

- **Banner**: the informational panel on the Review step (step 4) shown when the request cannot be submitted yet.
- **Missing item**: one concrete gap blocking submission: a project's supplier name, supplier address, or supplier phone; the payment method; a payment account number or bank name; or a project's Proforma document.
- **Supplier block**: the per-project supplier fields in step 3 (Supplier & Proforma).

## Requirements

### Requirement 1: Itemized list of what is missing

**User Story:** As a requester, I want the review banner to tell me exactly which fields or documents are missing, so that I know what to fix without re-reading the whole form.

#### Acceptance Criteria

1. WHEN the Review step renders with incomplete submission requirements THEN the Banner SHALL list each Missing item individually (for example: "Supplier phone for <project name>", "Supplier address for <project name>", "Proforma for <project name>", "Payment method", "Bank name for account 1", "Account number for account 1").
2. WHEN a project has a supplier name, address, and phone all filled THEN no Missing item SHALL be listed for that project's supplier fields.
3. WHEN a project has a Proforma attached (newly selected or previously uploaded) THEN no Missing item SHALL be listed for that project's Proforma.
4. WHEN payment method, account number, and (for bank method) bank name requirements are met THEN no Missing item SHALL be listed for payment.
5. WHEN every requirement is complete THEN the Banner SHALL NOT render and the existing ready-to-submit panel SHALL show instead (current behavior preserved).

### Requirement 2: Click-through navigation to the incomplete field

**User Story:** As a requester, I want to click a missing item in the banner and land on that exact field, so that I can fix it immediately.

#### Acceptance Criteria

1. WHEN a requester clicks a Missing item THEN the system SHALL navigate to the step containing that field (step 3, Supplier & Proforma).
2. WHEN the target step has rendered THEN the system SHALL scroll the specific target element into view (centered, smooth where supported).
3. WHEN the target element is a focusable input THEN the system SHALL focus it after scrolling.
4. WHEN the target element is not a plain input (the Proforma drop zone, the payment method selector) THEN the system SHALL apply a temporary visual highlight instead of focus.
5. The system SHALL work when the requester is currently on the Review step or when the same missing-item action is triggered from the save/submit warning path.
6. The system SHALL NOT change save logic, submit validation, draft behavior, or any other step's content.

### Requirement 3: No regressions in the request form

**User Story:** As a requester, I want the rest of the form to behave exactly as before, so that this change only adds navigation help.

#### Acceptance Criteria

1. The system SHALL keep the existing "save as draft" path working unchanged.
2. The system SHALL keep the submit-disabled condition identical (`!hasSupplierDetails || !hasPaymentDetails || !hasProformas`).
3. WHEN the Banner shows multiple Missing items THEN each SHALL be independently clickable.
