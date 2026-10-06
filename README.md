# Joyno Accounting

Vue 3 frontend for the accounting system. The shared shell contains the sidebar, topbar, navigation search, mobile drawer, and visual tokens. The Node API supports local SQLite and self-hosted PostgreSQL.

The local frontend uses real VPS records by default. The same application is hosted at [joynoadmin.tech](https://joynoadmin.tech); local development proxies its authenticated API through HTTPS. See [workspace setup](docs/CONNECTED_WORKSPACE.md).

The deployment target is the existing Ubuntu KVM 4 VPS, not Supabase. See [PostgreSQL and Ubuntu deployment](docs/KVM4_DEPLOYMENT.md).

The 6 October report release includes company settings/access, journals, financial statements/analytics, dashboard, sales/purchase documents and allocations, tax/payroll record tracking, banking, assets, private files and self-service accounts. Unsupported optional add-ons are hidden; sample adapters are test-only.

The same app is hosted at **https://joynoadmin.tech**, using the real backend without an SSH tunnel. See [domain deployment and rollback notes](docs/DOMAIN_DEPLOYMENT.md).

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

## Completion scope

The agreed record-tracking workflows are connected and tested. Owner sign-in, review of real company/account mappings, and a portable backup recovery passphrase still require private owner actions. See [completion checklist](docs/COMPLETION_CHECKLIST.md). No absolute security guarantee or official filing/calculation capability is claimed.

## Implemented modules

Implemented registers persist in company-scoped PostgreSQL records with server-side permissions and version checks. Payroll/tax scope is manual record tracking and report export, not calculation or official submission.

- **Accounting › Reports** (`src/features/accounting/reports`): General Ledger, Trial Balance, Income Statement (Annual, Annual Simplified, Monthly Simplified), and Balance Sheet. Reports have period filters, CSV export, and print layouts with company headers and signatories.
- **Accounting › Analytics** (`src/features/accounting/analytics`): Assets, Liabilities, Equities, Revenues, and Expenses, each with headline figures, a monthly trend, and a breakdown by category and account.
- **Company** (`src/features/company`): Profile, Owners, Registration, Recording, Reporting, Tax Rules, Users, Roles, Goods, Services, Other Items, Message Templates, Series, Report Templates and Audit Trail. Sales numbering is transactional; default report templates affect printing. Message wording can be prepared/copied, but no message-delivery service is configured.

### Ledger data contract (for the Journal Entries and Chart of Accounts layer)

Reports and analytics read real company accounts and journals through `LedgerSource` in `src/features/accounting/reports/ledgerContract.ts`. Amounts are integer centavos. Only posted journal lines affect balances; draft and voided records are excluded. Sample adapters are restricted to tests.

Summary of Sales loads fresh saved invoices and defaults to posted sources. Net sales exclude entered VAT. BIR books show posted accounting records for review/export, not an official registration or filing service.

### Assumptions to confirm

- The ledger has no closing entries, so the Balance Sheet shows revenue less expenses to date as "Current earnings" in equity.
- Statements group accounts by account category and show only revenue, expenses, and net income. Gross profit needs a cost-of-sales designation that the category setup does not define yet.
- Summary of Sales counts Unpaid and Paid invoices (drafts optional, cancelled never). VAT and withholding are listed as entered, not added to net sales.
- Tax Rules hold rates entered by the team. The app does not supply official rates.
- Users and roles are enforced by the server. Access changes revoke affected sessions, the last administrator is protected, and mutations and audits commit together.

## Backups

Nightly VPS PostgreSQL archives, including private files, are copied to the owner's Windows PC at 07:00 and sign-in, then encrypted and checked. Portable recovery export tools are installed but require a private owner-chosen passphrase. See [backup and recovery instructions](docs/WINDOWS_BACKUPS.md).
