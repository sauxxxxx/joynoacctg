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


# OWNER A — Assigned Scope

## Primary ownership
You own:
1. Sales
2. Accounting — Reports & Analytics
3. Company
4. Accounting-related reporting UI that is explicitly listed below

---

# 1. SALES

### Sales > Invoices
- Invoice list
- Create/edit/view invoice
- Invoice line items
- Customer selection
- Payment terms
- Payment method
- Discounts
- Totals and status
- Invoice search/filtering
- Printing/export if required by the project

### Sales > Collections
#### Receipts
- Receipt list
- Create/edit/view receipt
- Link receipt to customer/invoice
- Amount received
- Payment method
- Receipt status

#### Acknowledgement Receipts
- List
- Create/edit/view
- Customer/reference information
- Amount/details
- Print/export if required

### Sales > Setup
#### Customers
- Customer CRUD
- Customer details
- Customer status
- Search/filter

#### Payment Terms
- Payment-term CRUD
- Days/conditions
- Active/inactive status

#### Payment Methods
- Payment-method CRUD
- Active/inactive status

#### Discount Types
- Discount-type CRUD
- Percentage/fixed-value handling as required
- Active/inactive status

### Sales > Reports
#### Receivable Schedule
- Generate/display receivable schedule
- Filters
- Customer/invoice references
- Totals

#### Receivable Aging
- Aging buckets
- Customer/invoice breakdown
- Totals
- Date/filter controls

---

# 2. ACCOUNTING — REPORTS & ANALYTICS

You own ONLY the reporting/analytics pages below. Do not implement the Journal Entries pages or Accounting Setup pages owned by Owner B.

### Accounting > Reports
#### General Ledger (Detailed)
- Account-based ledger view
- Date range
- Debit/credit
- Running balance
- Reference/source
- Filtering/export as required

#### Trial Balance
- Account list
- Debit/credit totals
- Balance validation
- Date/period filtering

#### Income Statement
- Annual
- Annual (Simplified)
- Monthly (Simplified)

Include:
- Revenue
- Expenses
- Net income/loss
- Period filters
- Appropriate grouping

#### Summary of Sales
- Sales totals
- Period filtering
- Customer/category breakdown where applicable

#### Balance Sheet
- Assets
- Liabilities
- Equity
- Period/as-of-date filtering
- Accounting equation validation

### Accounting > Analytics
- Assets
- Liabilities
- Equities
- Revenues
- Expenses

Build the analytics views/charts/cards for these categories using accounting data exposed by the accounting layer. Do not implement the accounting journal-entry engine itself.

---

# 3. COMPANY

You own all Company pages listed here.

### Company
- Profile
- Owners
- Registration
- Recording
- Reporting
- Tax Rules

### Company > User Accounts
#### Users
- User list
- User CRUD
- User status
- Basic account information

#### Roles
- Role CRUD
- Permission assignment/display
- Role status

### Company > Items
#### Goods
- Goods/item CRUD
- Basic item information
- Pricing/unit fields as required
- Active/inactive status

#### Services
- Service CRUD
- Description/pricing fields as required
- Active/inactive status

#### Others
- Other item/type CRUD as required

### Company
- Message Templates
- Series
- Reports > Templates
- Reports > Audit Trail
- Add-ons
- Documents

For Audit Trail:
- Track relevant user actions
- Timestamp
- User
- Action/module/reference
- Search/filter

For Series:
- Maintain document numbering/series configuration.

---

# OUT OF SCOPE — DO NOT IMPLEMENT

The following belong to Owner B:

## Purchases
- Payables
- Payables > Invoices
- Payables > Payrolls
- Payments > Vouchers
- Cash Voucher
- Check Voucher
- Petty Cash Voucher
- Payments > Receipts
- Purchases Setup
- Vendors
- Revolving Fund Customers
- Purchases Discount Types
- Purchases Payment Terms
- Purchases Payment Methods
- Payable Schedule
- Payable Aging
- Revolving Fund Logs

## Accounting — Journal Entries & Setup
- General Journal
- Sales Journal
- Purchase Journal
- Cash Receipt Journal
- Cash Disbursement Journal
- Chart of Accounts
- Account Categories

## Government
- All Tax Management forms
- BIR Books
- Monthly forms
- Quarterly forms
- Yearly forms
- Other forms

## Banking
- Bank Accounts
- Bank Transactions

## Asset Management
- Fixed Assets

Do not create these pages even if they appear in the navigation.

---

# Suggested branch

`feature/owner-a`

# Suggested commit examples

- `feat(sales): add customer management`
- `feat(sales): add invoice management`
- `feat(sales): add collections receipts`
- `feat(accounting): add trial balance report`
- `feat(company): add user and role management`
- `feat(company): add audit trail`
