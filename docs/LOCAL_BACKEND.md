# Local backend

The normal frontend runs with `npm.cmd run dev` and uses the VPS HTTPS API by default. The separate Express service on port 3001 is an isolated SQLite development option, not the VPS database. To point a local frontend at that service deliberately, set `JOYNO_API_PROXY_TARGET=http://127.0.0.1:3001` before starting Vite.

## Implemented backend

- Health and OpenAPI documentation.
- Username/email sign-in, hashed passwords, expiring opaque sessions, sign-out, and sign-in rate limiting.
- Active company membership and role permission checks on every accounting endpoint.
- Persistent account categories and accounts, UUIDs, pagination, search, active filtering, and sorting.
- Version checks on updates/deletes; category hierarchy validation; audit records in the same transaction as each change.

The API also includes company settings/access, typed records, journals/posting/voiding, financial reports/dashboard, customers/vendors, sales/purchase documents and allocations, transactional numbering, banking, fixed assets, tax/payroll registers, private database-backed files, posted books, and self-service profile/password controls. Tax/payroll scope is manual tracking and export, not calculation or official submission. OpenAPI is the implemented endpoint reference.

## Requirements

Use Node 24.13 or later in the Node 24 line. SQLite uses Node's experimental `node:sqlite` module for isolated development. Database adapters are separated under `server/db`; PostgreSQL 17 on the existing Ubuntu KVM VPS is the deployed production database. Supabase is not used.

## Start the API

From `D:\Joyno\Desktop\joynoacctg`:

```powershell
npm.cmd run api:dev
```

Open `http://127.0.0.1:3001/api/v1/health` and `http://127.0.0.1:3001/api/v1/openapi.json`.

The database is created at `server/data/joyno.sqlite`, is ignored by Git, and survives server restarts. It starts empty. Migrations run when the server opens the database.

## Create the first local company and administrator

Bootstrap runs once on an empty local database. These local credentials are separate from the existing VPS administrator.

```powershell
$env:JOYNO_ADMIN_USERNAME = 'admin'
$env:JOYNO_COMPANY_NAME = 'Joyno'
$backendPassword = Read-Host 'Choose an admin password (12–128 characters)' -AsSecureString
$env:JOYNO_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $backendPassword).Password
npm.cmd run api:bootstrap
Remove-Item Env:\JOYNO_ADMIN_PASSWORD
```

Do not rerun bootstrap to reset data. There is no public registration endpoint. An authenticated administrator can manage users through Company › Users.

## API contract

All routes start with `/api/v1`:

| Route | Methods | Access |
| --- | --- | --- |
| `/health`, `/openapi.json` | GET | Public local diagnostics |
| `/auth/sign-in` | POST | Username/email and password |
| `/auth/sign-out` | POST | Bearer token |
| `/companies/{companyId}/accounts` | GET, POST | Accounting view/create |
| `/companies/{companyId}/accounts/{id}` | GET, PATCH, DELETE | Accounting view/edit/delete |
| `/companies/{companyId}/account-categories` | GET, POST | Accounting view/create |
| `/companies/{companyId}/account-categories/{id}` | GET, PATCH, DELETE | Accounting view/edit/delete |

Send `Authorization: Bearer <accessToken>` after sign-in. PATCH accepts the complete editable record plus `expectedVersion`. DELETE requires `?expectedVersion=1` (use the current version). Referenced categories reject deletion.

Errors match `BACKEND_SPEC.md`, and the implemented DTOs match the existing account frontend adapters. The broader backend specification remains the target contract rather than a claim that every endpoint is implemented.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `JOYNO_API_PORT` | `3001` | API port |
| `JOYNO_API_HOST` | `127.0.0.1` | Listener; containers use `0.0.0.0` without a public port |
| `JOYNO_DB_DRIVER` | `sqlite` | `sqlite` locally or `postgres` on Ubuntu |
| `JOYNO_DB_PATH` | `server/data/joyno.sqlite` | Local database file |
| `JOYNO_CORS_ORIGINS` | localhost and 127.0.0.1 on port 5173 | Comma-separated allowed browser origins |

Use PowerShell environment variables. `.env` files are not loaded by these server scripts.

## Verify

```powershell
npm.cmd run api:test
npm.cmd run test:run
npm.cmd run lint
npm.cmd run build
```

Backend tests use isolated in-memory databases. They cover authentication failures, logout, expiry, deactivation, company isolation, read-only roles, CRUD/version conflicts, transaction rollback, hierarchy rules, and 105-row pagination.

PostgreSQL schema/API tests also run with PGlite (embedded PostgreSQL). A native PostgreSQL pool/concurrency test runs only when `JOYNO_TEST_DATABASE_URL` is explicitly provided; otherwise it is skipped. See [KVM 4 deployment](KVM4_DEPLOYMENT.md). Existing SQLite files and local accounts are not automatically copied to PostgreSQL.
