# Accounting System — AI Development Scope

## Project collaboration
- This is a 2-person GitHub project.
- Work only inside the module/page ownership listed in this file.
- Do NOT implement, redesign, or modify pages owned by the other developer.
- Do NOT create placeholder implementations for the other developer's pages.
- If a feature requires data from another module, use a clearly defined interface/API/service contract rather than implementing the other module.
- Avoid changing shared configuration, routing, database schema, global components, or authentication unless it is necessary for your assigned work. If a shared change is necessary, keep it minimal and document it in the commit.
- Never overwrite or revert the other developer's work.
- Use Git branches and commits for your assigned scope.

## Quality expectations
- Build production-like, maintainable code rather than static mockups.
- Keep UI consistent across your assigned pages.
- Implement validation, loading states, empty states, errors, permissions, and confirmation dialogs where appropriate.
- Use reusable components within your own module.
- Keep business/accounting calculations deterministic and testable.
- Do not invent accounting rules when the requirement is unclear; isolate assumptions and flag them.


# OWNER B — Assigned Scope

## Primary ownership
You own:
1. Purchases
2. Accounting — Journal Entries & Setup
3. Government / Tax Management
4. Banking
5. Asset Management

---

# 1. PURCHASES

### Purchases > Payables
#### Invoices
- Payable invoice list
- Create/edit/view invoice
- Vendor selection
- Line items
- Payment terms
- Payment method
- Discounts
- Amounts/status
- Search/filtering

#### Payrolls
- Payroll-related payable records
- List/create/view as required by the project specification
- Amount/status/reference fields

### Purchases > Payments > Vouchers

#### Cash Voucher
- Create/edit/view
- Payee/vendor
- Amount
- Date
- Reference
- Account/category linkage
- Status

#### Check Voucher
- Create/edit/view
- Payee/vendor
- Check information
- Amount
- Date
- Reference
- Status

#### Petty Cash Voucher
- Create/edit/view
- Payee/purpose
- Amount
- Date
- Reference
- Status

### Purchases > Payments > Receipts
- Receipt list
- Create/edit/view
- Reference information
- Amount
- Date
- Status

### Purchases > Setup

#### Vendors
- Vendor CRUD
- Vendor details
- Status
- Search/filter

#### Revolving Fund Customers
- CRUD
- Relevant revolving-fund information
- Status

#### Discount Types
- CRUD
- Percentage/fixed handling as required
- Status

#### Payment Terms
- CRUD
- Days/conditions
- Status

#### Payment Methods
- CRUD
- Status

### Purchases > Reports

#### Payable Schedule
- Payable schedule
- Vendor/invoice references
- Date filters
- Totals

#### Payable Aging
- Aging buckets
- Vendor/invoice breakdown
- Totals
- Date/filter controls

#### Revolving Fund Logs
- Transaction/log list
- References
- Amounts
- Dates
- Running/summary information as required

---

# 2. ACCOUNTING — JOURNAL ENTRIES & SETUP

You own ONLY these Accounting pages. Owner A owns Accounting Reports & Analytics.

### Accounting > Journal Entries

#### General Journal
- Journal-entry list
- Create/edit/view
- Debit/credit lines
- Account selection
- Date/reference/description
- Balanced-entry validation

#### Sales Journal
- Sales journal
- Date/period filtering
- Source/reference
- Debit/credit or appropriate accounting presentation
- Totals

#### Purchase Journal
- Purchase journal
- Date/period filtering
- Source/reference
- Debit/credit
- Totals

#### Cash Receipt Journal
- Cash receipt journal
- Date/period filtering
- Source/reference
- Debit/credit
- Totals

#### Cash Disbursement Journal
- Cash disbursement journal
- Date/period filtering
- Source/reference
- Debit/credit
- Totals

### Accounting > Setup

#### Chart of Accounts
- Account CRUD
- Account code
- Account name
- Account type
- Parent/child hierarchy if required
- Active/inactive status

#### Account Categories
- Category CRUD
- Category/type mapping
- Active/inactive status

### Important integration rule
Owner A will build:
- General Ledger
- Trial Balance
- Income Statement
- Summary of Sales
- Balance Sheet
- Accounting Analytics

Provide clean, documented data/API/service contracts so Owner A can consume journal/accounting data. Do not build Owner A's report pages.

---

# 3. GOVERNMENT > TAX MANAGEMENT

You own the entire Government Tax Management section.

### Monthly
- 2550M
- 0619-E
- 0619-F
- 1601-C
- 1600-VT
- BIR Books

### Quarterly
- 2550Q
- 1702Q
- 1601EQ
- 1601FQ

### Yearly
- 1604-C
- 1604-E
- 1604-F
- 1702RT
- 0605

### Others
- 2306
- 2307

For each form:
- Form-specific data entry
- Validation
- Period/tax-year selection
- Save/edit/view
- Status
- Appropriate totals/calculations
- Print/export if required
- Keep the implementation modular so forms do not become one giant component.

### BIR Books
- Book selection
- Relevant entries
- Date/period filtering
- View/export as required

Do not invent official tax formulas or filing requirements. Where exact rules are required, use the project's provided accounting requirements or authoritative Philippine tax documentation.

---

# 4. BANKING

### Bank Accounts
- Bank account CRUD
- Bank name
- Account number/reference fields
- Account type
- Opening/current balance fields as required
- Active/inactive status

### Bank Transactions
- Transaction list
- Deposits/withdrawals/transfers as required
- Date
- Reference
- Amount
- Account
- Status
- Search/filtering

---

# 5. ASSET MANAGEMENT

### Fixed Assets
- Fixed asset CRUD
- Asset code
- Asset name/description
- Acquisition date
- Acquisition cost
- Category
- Useful life where required
- Status/location
- Depreciation-related fields if required by the specification
- Asset history

Do not modify Owner A's Sales or Company pages.

---

# OUT OF SCOPE — DO NOT IMPLEMENT

The following belong to Owner A:

## Sales
- Invoices
- Collections
- Receipts
- Acknowledgement Receipts
- Customers
- Payment Terms
- Payment Methods
- Discount Types
- Receivable Schedule
- Receivable Aging

## Accounting — Reports & Analytics
- General Ledger
- Trial Balance
- Income Statement
- Summary of Sales
- Balance Sheet
- Analytics: Assets
- Analytics: Liabilities
- Analytics: Equities
- Analytics: Revenues
- Analytics: Expenses

## Company
- Profile
- Owners
- Registration
- Recording
- Reporting
- Tax Rules
- Users
- Roles
- Goods
- Services
- Others
- Message Templates
- Series
- Report Templates
- Audit Trail
- Add-ons
- Documents

Do not create these pages even if they appear in the navigation.

---

# Suggested branch

`feature/owner-b`

# Suggested commit examples

- `feat(purchases): add vendor management`
- `feat(purchases): add payable invoices`
- `feat(purchases): add payment vouchers`
- `feat(accounting): add chart of accounts`
- `feat(accounting): add journal entries`
- `feat(government): add monthly tax forms`
- `feat(banking): add bank accounts`
- `feat(assets): add fixed asset management`
