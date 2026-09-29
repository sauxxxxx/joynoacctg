# Joyno Accounting

Vue 3 frontend for the accounting system. The shared shell contains the sidebar, topbar, navigation search, mobile drawer, and visual tokens. Supabase integration is a later slice.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. Use `npm.cmd run build` to type-check and create a production build.

## Structure

- `src/navigation.ts` — menu hierarchy shared by the sidebar and topbar search.
- `src/components/` — shell components.
- `src/styles.css` — visual tokens and responsive shell styling.
- `src/App.vue` — selected section and shell layout.

Menu selections update the URL, so a page can be linked and reloaded.

## Owner B frontend preview

Open **Accounting → Journal Entries → Purchase Journal**, or visit `/?page=purchase-journal`. This page uses labeled sample entries. Date filtering, search, review selection, and entry details work in the browser. **Move to CDJ** remains disabled until the transfer rules and data service are defined.

## Owner A frontend preview

Sales, Accounting Reports & Analytics, and Company pages. All data is kept in the browser tab and resets on reload until the backend is connected.

- **Accounting › Reports** (`src/features/accounting/reports`): General Ledger (Detailed), Trial Balance, Income Statement (Annual, Annual Simplified, Monthly Simplified), Summary of Sales, and Balance Sheet. Each report has period filters, CSV export, and a print layout with the company header and signatories from Company › Profile and Company › Reporting.
- **Accounting › Analytics** (`src/features/accounting/analytics`): Assets, Liabilities, Equities, Revenues, and Expenses, each with headline figures, a monthly trend, and a breakdown by category and account.
- **Company** (`src/features/company`): Profile, Owners, Registration, Recording, Reporting, Tax Rules, Users, Roles, Goods, Services, Others, Message Templates, Series, Report Templates, Audit Trail, Add-ons, and Documents.

### Ledger data contract (for the Journal Entries and Chart of Accounts layer)

Reports and analytics read journal data only through `LedgerSource` in `src/features/accounting/reports/ledgerContract.ts`: accounts (code, name, type, category) and journal entries with debit/credit lines in integer centavos. Only `posted` entries are reported. Until a journal service implements it, `useLedger.ts` uses the clearly labeled sample ledger in `sampleLedger.ts`; call `setLedgerSource()` or change the one line in `useLedger.ts` to switch.

Summary of Sales reads Sales › Invoices directly rather than the ledger.

### Assumptions to confirm

- The ledger has no closing entries, so the Balance Sheet shows revenue less expenses to date as "Current earnings" in equity.
- Statements group accounts by account category and show only revenue, expenses, and net income. Gross profit needs a cost-of-sales designation that the category setup does not define yet.
- Summary of Sales counts Unpaid and Paid invoices (drafts optional, cancelled never). VAT and withholding are listed as entered, not added to net sales.
- Tax Rules hold rates entered by the team. The app does not supply official rates.
- Users and Roles are recorded but not enforced, because sign-in is not connected. Audit events are attributed to "Preview session".
