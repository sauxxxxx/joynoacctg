# Local backend

The frontend preview continues to run with `npm.cmd run dev`. Leave `VITE_API_BASE_URL` unset while using preview mode. The backend is a separate Express service on port 3001; no frontend pages are switched to it automatically.

## First slice available

- Health and OpenAPI documentation.
- Username/email sign-in, hashed passwords, expiring opaque sessions, sign-out, and sign-in rate limiting.
- Active company membership and role permission checks on every accounting endpoint.
- Persistent account categories and accounts, UUIDs, pagination, search, active filtering, and sorting.
- Version checks on updates/deletes; category hierarchy validation; audit records in the same transaction as each change.

Other business modules are not implemented yet. Start journals and posting next, then sales/purchases, banking, assets, and reports. Government calculations need confirmed requirements before implementation.

## Requirements

Use Node 24.13 or later in the Node 24 line. This local slice uses Node's built-in `node:sqlite` module, which is still experimental in the installed runtime. Its database adapter is isolated under `server/db`; PostgreSQL/Supabase remains the intended later production database choice. SQLite is for this local development slice.

## Start the API

From `D:\Joyno\Desktop\joynoacctg`:

```powershell
npm.cmd run api:dev
```

Open `http://127.0.0.1:3001/api/v1/health` and `http://127.0.0.1:3001/api/v1/openapi.json`.

The database is created at `server/data/joyno.sqlite`, is ignored by Git, and survives server restarts. It starts empty. Migrations run when the server opens the database.

## Create the first local company and administrator

Bootstrap runs once on an empty database. Choose your own local credentials; the preview login is separate.

```powershell
$env:JOYNO_ADMIN_USERNAME = 'admin'
$env:JOYNO_COMPANY_NAME = 'Joyno'
$backendPassword = Read-Host 'Choose an admin password (12–128 characters)' -AsSecureString
$env:JOYNO_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $backendPassword).Password
npm.cmd run api:bootstrap
Remove-Item Env:\JOYNO_ADMIN_PASSWORD
```

Do not rerun bootstrap to reset data. There is no public registration endpoint or user administration endpoint in this slice.

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
| `JOYNO_API_PORT` | `3001` | API port; binds to `127.0.0.1` |
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
