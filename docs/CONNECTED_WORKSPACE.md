# Local preview with real VPS records

The same application is hosted at **https://joynoadmin.tech**. Both the hosted site and normal local development use real VPS records. PostgreSQL has no public port. The VPS API remains loopback-only behind the authenticated HTTPS routes.

There is one normal login, not a separate “VPS accounting” system. Sample adapters are available only in automated tests. Unsupported pages are blocked, and failed API requests never fall back to invented records. The real company starts empty unless its users enter records.

## Windows startup

In one PowerShell terminal:

```powershell
cd D:\Joyno\Desktop\joynoacctg
npm.cmd run dev
```

No second terminal or SSH tunnel is needed. Vite forwards `/vps-api` requests to `https://joynoadmin.tech` with TLS verification enabled. The separate SQLite development API on port 3001 is not needed for the normal local frontend. It remains available for isolated development; it is not the VPS database.

Open [local accounting](http://localhost:5173/). Sign in as `admin` with the fresh private password chosen on the VPS. Do not paste passwords or private keys into chat. If Vite was already running before the proxy configuration changed, restart it with `npm.cmd run dev`.

The old `?mode=preview` and `?mode=connected` links no longer change the normal data source. The browser keeps an expiring session token in session storage and may remember the username, but not the password.

## First records and failures

The real company begins empty; sample accounts are not copied. Create an Account Category first, optionally map its account type, then create accounts under it. Edits/deletes send record versions; conflicts retain your draft. Cancel, Reload, and reopen the record before reapplying changes after a conflict. Server writes close the editor only after confirmation.

If the API is unreachable, sign-in shows a connection message and lists show a retryable error. Reload restores saved records while an unexpired session exists; logout clears cached data and revokes the token.

## Configuration and verification

`JOYNO_API_PROXY_TARGET` overrides the HTTPS target for isolated development; the legacy `JOYNO_VPS_TUNNEL_URL` override remains supported. Vite exposes only `VITE_` variables to the browser; never use that prefix for secrets.

The production build uses same-origin `/api/v1` by default; no database credentials are embedded. The development proxy is not part of that build. HTTPS/authentication and login rate limiting protect the public API; database and direct API ports remain private.

Run `npm.cmd run test:run`, `npm.cmd run api:test`, `npm.cmd run lint`, and `npm.cmd run build`. Optional browser verification uses `node server/tests/browserFixture.js` (a disposable in-memory PostgreSQL engine, not the VPS) and a separate Vite on 5174 with `JOYNO_VPS_TUNNEL_URL=http://127.0.0.1:3003`. Its test-only credentials are in the fixture source. No production accounts are created/modified by these checks.

The 6 October report release connects company settings/access, journals, financial reports/dashboard, tax/payroll tracking and exports, customer/vendor setup, sales/purchase documents and reviewed postings, receipts/allocations, private uploaded files, self-service accounts, banking, assets, posted books, sales summary and fund movement logs. Sales numbering and saved print templates are integrated. Nightly VPS backups and encrypted PC copies have passed restore checks. See `COMPLETION_CHECKLIST.md` for owner acceptance and portable recovery steps.

Verified on 6 October 2026: 53 frontend tests and 37 local backend tests passed; one native PostgreSQL test was skipped locally and passed separately on the VPS against a disposable database. Lint, type-check/build, dependency audit, source-size checks, selected browser workflows and restored-copy startup/file recovery passed. Real administrator sign-in still requires the user's private password. Dependency annotation and large lazy-loaded ExcelJS build warnings remain.
