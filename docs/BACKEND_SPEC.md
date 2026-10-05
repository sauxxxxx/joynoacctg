# Joyno Accounting Backend Specification

## Scope and assumptions

This document is the handoff contract for replacing the frontend preview repositories with a real API or Supabase adapters. The current frontend remains a desktop-only preview. Authorization checks in the browser improve UX only; the backend and database must enforce every permission and tenant boundary.

Assumptions requiring product/accounting confirmation:

- One user may belong to one or more companies, with one role per company membership.
- Philippine peso values are stored as integer centavos.
- Journal entries are immutable after posting. A void is a state change plus an audit event; a future reversal feature should create a new linked journal.
- Sales invoice posting debits Accounts Receivable and credits Sales Revenue. Receipt posting debits Cash and credits Accounts Receivable.
- Bank transactions whose purpose contains deposit, receipt, collection, or income are treated as receipts in the preview; production must use an explicit direction enum.
- Fixed assets use straight-line monthly depreciation and cannot depreciate below salvage value.
- Dates represent local business dates in `YYYY-MM-DD`; timestamps are UTC ISO 8601.

## Authentication

- No public registration endpoint or UI.
- Administrators create and deactivate users.
- Sign-in accepts username or email plus password.
- Inactive users and inactive company memberships cannot authenticate.
- Sessions expire server-side and return `401 SESSION_EXPIRED`; the client clears local state and returns to login.
- Password reset is administrator-assisted or email-token based when email delivery is configured.
- Recommended Supabase path: Auth user plus `profiles`, `companies`, and `company_memberships` tables.

## Roles and permissions

Actions: `view`, `create`, `edit`, `delete`.

Modules: Sales, Purchases, Accounting, Government, Banking, Asset Management, Company, Documents.

| Role | Default access |
| --- | --- |
| Administrator | All actions in all modules; user and role administration |
| Accountant | View/create/edit operational and accounting records; posting when granted; no user administration |
| Viewer | View only for assigned modules |

Store permissions as role-module-action rows or a validated JSONB matrix. Every API operation maps to a module/action and checks the active membership. Posting, voiding, transfer, file access, export, and user administration require explicit permissions.

## Conventions

- Primary keys: UUID.
- Foreign keys: UUID, indexed, and tenant-scoped.
- Money: signed `BIGINT` centavos. Never `FLOAT`, `REAL`, or client-calculated database totals.
- Business dates: SQL `DATE` serialized as `YYYY-MM-DD`.
- Timestamps: `TIMESTAMPTZ` serialized as ISO 8601 UTC.
- Optimistic concurrency: mutable records include integer `version`; updates require `expectedVersion`.
- Soft deletion is preferred for referenced master data. Posted accounting data is never deleted.
- User-entered reference numbers have company-scoped unique indexes where noted.

## Proposed tables

### Identity and tenancy

- `profiles(id PK/FK auth.users, username UNIQUE, display_name, email, active, created_at, updated_at)`
- `companies(id PK, legal_name, trade_name, tin, rdo, fiscal_year_end_month, active, created_at, updated_at)`
- `company_memberships(id PK, company_id FK, user_id FK, role_id FK, active, UNIQUE(company_id,user_id))`
- `roles(id PK, company_id FK nullable for system roles, name, description, active, system, UNIQUE(company_id,name))`
- `role_permissions(role_id FK, module, action, allowed, PK(role_id,module,action))`

### Master data

- `account_categories(id PK, company_id FK, code, name, parent_id FK self nullable, account_type, active, UNIQUE(company_id,code))`
- `accounts(id PK, company_id FK, category_id FK, code, name, account_type, active, version, UNIQUE(company_id,code))`
- `customers(id PK, company_id FK, name, tin, email, address fields, active, version)`
- `vendors(id PK, company_id FK, name, tin, email, address fields, active, version)`
- `items(id PK, company_id FK, item_type, code, name, description, active, version, UNIQUE(company_id,code))`
- `payment_terms(id PK, company_id FK, module, name, due_on, due_unit, payments, frequency_every, frequency_unit, active)`
- `payment_methods(id PK, company_id FK, module, name, account_id FK nullable, active)`
- `discount_types(id PK, company_id FK, module, name, computation, rate_basis_points, account_id FK nullable, active)`

### Sales and purchases

- `sales_documents(id PK, company_id FK, document_type, number, customer_id FK, document_date, due_date, status, payment_term_id FK, payment_method_id FK, subtotal_cents, discount_cents, vat_cents, total_cents, remarks, version, UNIQUE(company_id,document_type,number))`
- `sales_document_lines(id PK, document_id FK, item_id FK nullable, description, quantity_scaled, unit_price_cents, withholding_tax_cents, vat_cents, line_total_cents, position)`
- `receipt_allocations(id PK, receipt_id FK sales_documents, invoice_id FK sales_documents, amount_cents, UNIQUE(receipt_id,invoice_id))`
- `purchase_documents(id PK, company_id FK, document_type, number, vendor_id FK, document_date, status, payment_term_id FK, payment_method_id FK, subtotal_cents, tax_cents, total_cents, paid_cents, remarks, version, UNIQUE(company_id,document_type,number))`
- `purchase_document_lines(id PK, document_id FK, item_id FK nullable, description, quantity_scaled, unit_price_cents, line_total_cents, position)`

### Accounting

- `journal_entries(id PK, company_id FK, journal_type, entry_number, entry_date, reference, description, status, source_type, source_id, posted_at, posted_by FK, voided_at, voided_by FK, version, UNIQUE(company_id,journal_type,entry_number), UNIQUE(company_id,source_type,source_id,journal_type))`
- `journal_lines(id PK, journal_entry_id FK, account_id FK, subsidiary_type nullable, subsidiary_id nullable, debit_cents, credit_cents, memo, position)`
- Database constraints must enforce nonnegative debit/credit, exactly one positive side per line, and balanced totals at posting time through a transaction-safe function.

### Banking and assets

- `bank_accounts(id PK, company_id FK, name, bank_name, account_number, ledger_account_id FK, remarks, active, version, UNIQUE(company_id,account_number))`
- `bank_transactions(id PK, company_id FK, bank_account_id FK, transaction_date, direction, purpose, party_type, party_id nullable, counter_account_id FK, amount_cents, reference, description, status, journal_entry_id FK nullable, version)`
- `fixed_assets(id PK, company_id FK, tracking_number, vendor_id FK, item_id FK nullable, purchase_document_id FK nullable, date_purchased, description, purchase_price_cents, vat_cents, useful_life_months, salvage_value_cents, lapsed_months, warranty_expiration_date, status, version, UNIQUE(company_id,tracking_number))`

### Government and documents

- `tax_records(id PK, company_id FK, form_type, period_start, period_end, filing_year, status, amount_cents, deadline, entry_reference, version, UNIQUE(company_id,form_type,period_start,period_end))`
- `tax_certificates(id PK, company_id FK, form_type, source_type, source_id, party_type, party_id, status, amount_cents, certificate_date, from_date, to_date, tin_snapshot, signed_document_id FK nullable, version)`
- `documents(id PK, company_id FK, storage_bucket, storage_path, file_name, mime_type, size_bytes, checksum, reference_type, reference_id, created_by FK, created_at)`
- `audit_events(id PK, company_id FK, actor_user_id FK, action, entity_type, entity_id, source_type, source_id, before_json, after_json, request_id, created_at)`

## Status enums and transitions

- Documents: `draft -> issued/posted -> cancelled` as allowed by document type.
- Journal: `draft -> posted -> voided`. Posted and voided entries are read-only.
- Bank transaction: `draft -> journalized`; store `journal_entry_id`.
- Tax certificate: `draft -> received` or `draft -> sent`; `received -> sent` when applicable.
- Fixed asset: `active -> fully_depreciated -> disposed` in a later disposal workflow.
- Users, roles, accounts, parties, items: active/inactive, never hard-delete when referenced.

Invalid transitions return `409 INVALID_STATE_TRANSITION` with current and allowed states.

## CRUD and operation endpoints

Use `/api/v1/companies/{companyId}` as the tenant prefix.

- Standard resources expose `GET collection`, `GET /{id}`, `POST`, `PATCH /{id}`, and `DELETE /{id}` when deletion is valid.
- Master-data DELETE generally deactivates; draft transactional DELETE may hard-delete if unreferenced.
- Posted documents and journal entries reject PATCH/DELETE.
- `POST /journal-entries/{id}/post` validates permissions, version, active accounts, line rules, and balance in one transaction.
- `POST /journal-entries/{id}/void` preserves lines and creates an audit event.
- `POST /purchase-documents/{id}/create-journal`
- `POST /payments/{id}/create-cash-disbursement-journal`
- `POST /receipts/{id}/create-cash-receipt-journal`
- `POST /sales-documents/{id}/create-sales-journal`
- `POST /bank-transactions/{id}/create-journal`
- `POST /tax-certificates/{id}/receive` and `/send`
- Special journal operations are idempotent by `(company_id, source_type, source_id, journal_type)` and return the existing journal on replay.
- Multi-record operations are atomic: all selected sources succeed or none change.

## DTO examples

Create sales document request:

```json
{
  "customerId": "uuid",
  "date": "2026-09-30",
  "paymentTermId": "uuid",
  "paymentMethodId": null,
  "remarks": "Monthly service",
  "lines": [{ "itemId": "uuid", "description": "Service", "quantityScaled": 1000, "unitPriceCents": 250000 }]
}
```

Post journal request and response:

```json
{ "journalEntryId": "uuid", "expectedVersion": 2 }
```

```json
{ "data": { "journalEntryId": "uuid", "status": "posted", "postedAt": "2026-09-30T08:15:00Z", "auditEventId": "uuid" }, "requestId": "uuid" }
```

## Validation rules

- Trim identifiers and human-readable strings; reject empty required values.
- Validate dates as real calendar dates and ensure range end is not before start.
- Require company-scoped referenced entities to exist and be active.
- Money must be safe integer centavos within configured maximums.
- Document totals are calculated server-side from validated lines; do not trust client totals.
- Paid amount cannot be negative or exceed document total.
- Journal entries require at least two lines, active account IDs, exactly one side per line, and equal positive debit/credit totals.
- Fixed-asset useful life is a positive integer; lapsed months are nonnegative; salvage value cannot exceed purchase price.
- Uploaded metadata is never trusted; inspect MIME type, extension, size, and checksum server-side.
- Return field errors using paths matching the shared frontend schemas.

## Error contract

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the highlighted fields.",
    "fieldErrors": { "lines.0.accountId": ["Choose an active account."] },
    "requestId": "uuid"
  }
}
```

Expected codes: `VALIDATION_ERROR` (422), `UNAUTHENTICATED` (401), `SESSION_EXPIRED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `INVALID_STATE_TRANSITION` (409), `RATE_LIMITED` (429), and `INTERNAL_ERROR` (500).

## Pagination, filter, and sort

Request query:

- `page` starts at 1.
- `pageSize` defaults to 25 and is capped at 100.
- `search` is trimmed text.
- Resource-specific filters use explicit keys such as `status`, `from`, `to`, `vendorId`, and `customerId`.
- `sortBy` is an allow-listed field; `sortDirection` is `asc` or `desc`.

Response: `{ data, page, pageSize, total, totalPages, requestId }`. Stable sorts must include `id` as the final tie-breaker. Add indexes for tenant ID plus common date/status/filter columns.

## RLS policy matrix

| Table group | Select | Insert | Update | Delete |
| --- | --- | --- | --- | --- |
| Tenant/master data | Active membership + module view | module create | module edit | module delete; reject referenced rows |
| Documents | Active membership + Documents view | Documents create | owner/admin or Documents edit | Documents delete and unreferenced |
| Operational transactions | module view | module create | module edit and draft only | module delete and draft only |
| Journal entries/lines | Accounting view | accounting operation function only | post/void function only | never after posting |
| Users/memberships/roles | Company view | Administrator | Administrator | Administrator; protect last administrator |
| Audit events | Administrator or authorized auditor | trusted service/function only | never | never |

RLS must derive the user ID from the authenticated session, join active memberships, and scope every row to `company_id`. Service-role credentials must never ship to the browser.

## File storage

- Private company-scoped bucket; paths begin with `{companyId}/{entityType}/{entityId}/`.
- Signed URLs are short-lived and issued only after permission checks.
- Enforce allowed MIME types and configurable size limits; scan files before final availability.
- Store checksum, original filename, safe generated storage name, uploader, and timestamps.
- Deleting a draft reference may remove its file after a retention window. Posted-record files follow retention policy and remain auditable.

## Audit logging

Audit sign-in outcomes, user/role changes, master-data changes, create/update/delete, posting, voiding, journal transfers, tax receive/send, exports, and file actions. Capture actor, tenant, request ID, entity, action, UTC timestamp, source linkage, and redacted before/after snapshots. Audit records are append-only.

## Seed and test data

- Seed one company, administrator, accountant, viewer, roles/permissions, chart of accounts, customers, vendors, items, bank account, and tax settings.
- Include 0-, 1-, and 105-row datasets; long names; missing optional values; maximum supported money; leap-day and invalid dates; inactive relationships; balanced/unbalanced journals; duplicate source posting; expired sessions; and permission-denied cases.
- Integration tests must cover transaction rollback, idempotency, tenant isolation, RLS, status transitions, audit creation, pagination stability, file authorization, and error serialization.
