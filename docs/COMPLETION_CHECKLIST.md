# Accounting application completion checklist

Scope agreed 6 October 2026: the existing application, real persisted company records, and user-facing language. Payroll/tax scope is tracking records and exporting reports, not payroll calculations or official filing submission. Existing production data must be preserved; test data must not be copied into the real company.

Completion requires verification, not merely removing notices or enabling menu items.

- [x] One normal login and familiar implemented navigation; no developer workspace controls or sample figures in real-data mode. Unimplemented optional add-ons are hidden.
- [x] Company profile, registration, recording/account mappings, reporting and tax preferences saved with concurrency checks.
- [x] Real user creation/password reset, active roles/permissions, last-administrator protection, session revocation.
- [x] Owners/items persist with tenant checks; sales numbering assigns under transaction locks, including period resets. Saved default report templates apply to printing. Message templates prepare wording, not automatic delivery.
- [x] Journal drafting/posting/voiding, positive balanced lines, active account validation, closed-period controls, immutable posted records and transactional audit.
- [x] Customers, vendors, sales/purchase documents, receipts and allocations persist with server-calculated centavo amounts, relationship validation, duplicate-payment protection and transactional bulk invoice saves.
- [x] Banking and sales/purchase source-to-journal operations are atomic and idempotent. Source posting requires reviewed balanced account allocations; voiding preserves history.
- [x] Assets and government record tracking persisted; downloads reflect real records.
- [x] Ledger, financial statements, schedules/aging, sales summary, posted books, fund movement logs, analytics and dashboard read real transactions with loading/error/empty states. Fund logs report period net movement, not an invented opening balance.
- [x] Private database-backed PDF/image storage, authorized attachment download, signature/size/quota/checksum checks, and recoverable archive/restore. No public file URLs. Signature checks are not antivirus scanning.
- [x] Account profile/password controls verify the current password and revoke sessions; record/report exports use saved records. New password hashes use strengthened scrypt; legacy hashes upgrade on legitimate sign-in.
- [x] OpenAPI contracts and tenant/permission/concurrency/rollback regression tests pass; disposable browser save/reload/failure/post/export, numbering, printing, files and account workflows verified.
- [x] Reviewed schema 1–4, restored-copy startup, HTTPS deployment, scheduled server and encrypted off-server copies, native file-content restore, compatible rollback and periodic operational health checks verified.
- [ ] Owner sign-in using the undisclosed real administrator password and review of actual company records/account mappings.
- [ ] Owner creates a portable recovery archive with a private passphrase and keeps it on a separate trusted device. Tools are installed and tested; this private owner step cannot be completed on their behalf without choosing their secret.

Off-server backup destination: the owner's Windows PC, approved 6 October 2026. No paid backup service is assumed. Scheduled server backups and encrypted PC copies have passed restore checks. Scheduled copies require the Windows profile; independently recoverable manual exports require the owner's private passphrase. See `WINDOWS_BACKUPS.md`.

6 October report release checkpoint: hosted UI `/var/www/joynoacctg/releases/20261006-reports-01`, API image `d702b40b137b`, schema 1–4. Local Vite on 5173 proxies the same HTTPS API. 53 frontend tests, 37 local backend tests, one additional native PostgreSQL test, lint/type-check/build, dependency audit (zero known vulnerabilities), source-size checks and selected disposable browser workflows pass. Post-release archive `joyno-20261006T052359Z-1918286.dump` was copied, encrypted and restored from the PC successfully. Production fixtures were never added.

Operational limits: the VPS health timer reports failures to systemd/journald; no email/SMS/external alert destination is configured. The PC must be online and signed in for scheduled copies. Retention has not been set, so no existing backup is automatically deleted. The VPS and SSH key are shared infrastructure; this work does not certify all other applications or provide an independent penetration test. Build warnings for vendor annotations and the lazy-loaded ExcelJS bundle remain. These qualifications and owner steps prevent an honest claim of absolute security or universal completion.
