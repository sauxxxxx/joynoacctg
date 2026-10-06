# KVM 4 backend and domain status

Initial deployment: 5 October 2026. Latest verified release: 6 October 2026 (Asia/Manila).

- VPS: `187.53.140.168`, Ubuntu 26.04.1 LTS; SSH user `root`.
- Source directory: `/opt/joynoacctg`; Compose directory: `/opt/joynoacctg/deploy/ubuntu`.
- New Compose project: `joynoacctg`, separate from `joyno-hr` and `kokoro`.
- PostgreSQL 17: `joynoacctg-postgres-1`; volume `joynoacctg_postgres_data`; no public database port.
- API: `joynoacctg-api-1`; host listener **127.0.0.1:3101** remains loopback-only. Nginx now exposes its authenticated routes through HTTPS `/api/v1` on `joynoadmin.tech`.
- Existing HR API on port 3001 and existing Nginx configuration were not changed.
- Backend and database health checks pass. The native PostgreSQL pool/concurrent-edit/audit-rollback test passed in a separate disposable database.
- The Windows/Linux lockfile mismatch was repaired by restoring missing bundled dependency records without upgrading existing dependency versions. The API image builds from `npm ci --omit=dev`.
- Only the API service builds the shared image; the migration job reuses it, preventing concurrent image-tag build races.
- Private database credentials were generated on the VPS and saved in `.env` with mode 600; they were not uploaded from the local project or printed.
- Initial backup: `/opt/joynoacctg/deploy/ubuntu/backups/joyno-20261005T083900Z-1539454.dump`.
- That archive was restored into a disposable database and its migration metadata checked successfully. Verification databases were removed afterward; the application database and backup archive remain intact.
- The user created company `Joyno` (`22571264-b1c7-4a0a-b23a-7b405822436c`) and administrator `admin` through the hidden VPS bootstrap prompt. Local SQLite users/data were not copied; the chosen password was not disclosed.
- The local frontend and hosted frontend use the same real VPS company records. Sample mode is test-only; see `CONNECTED_WORKSPACE.md`.
- The same frontend is published at **https://joynoadmin.tech**, defaulting to the real backend; `www` redirects to the root domain. No SSH tunnel is needed to use the hosted app. Local preview remains unchanged.
- Current frontend: `/var/www/joynoacctg/releases/20261006-reports-01`; `current` is its release symlink. Isolated Nginx vhost: `/etc/nginx/sites-available/joynoacctg`; other vhosts were not replaced. Older frontend assets are retained for already-open browsers.
- HTTPS headers include CSP, frame denial, no-store, nosniff and one-year HSTS for the accounting host. HSTS deliberately does not include unrelated subdomains. Certificate renewal remains scheduled.
- Let's Encrypt certificate covers the root and `www`, initially expiring 3 January 2027. Certbot has a scheduled renewal and a domain-specific Nginx reload hook.
- A pre-domain deployment database backup was created: `/opt/joynoacctg/deploy/ubuntu/backups/joyno-20261005T100031Z-1567594.dump`. A root-only environment backup and the prior accounting HTTP vhost were preserved beside the deployment scripts.
- Scheduled PostgreSQL backups are enabled as `joynoacctg-backup.timer`, at approximately 03:00 Manila time. Completed archives are checksum-verified and kept private on the VPS.
- Off-server copies are enabled on the owner's Windows PC: `D:\Joyno\Backups\joynoacctg`, daily at 07:00 and at sign-in. The task has completed successfully. The encrypted PC copy of `joyno-20261006T023754Z-1858080.dump` passed a disposable PostgreSQL restore check on 6 October 2026. See `WINDOWS_BACKUPS.md` for Windows-profile recovery requirements.
- Current API image: `d702b40b137b`, tagged `joyno-accounting-api:verify-20261006-05` and `:local`; migrations 1–4 are applied. The API has a read-only root filesystem, unprivileged Node user, dropped capabilities and no-new-privileges. Native PostgreSQL concurrency tests and restored-copy startup passed before publishing.
- Sales/purchase source documents, receipts/allocations, payroll/tax tracking/exports, financial reports, posted books, fund movement logs, automatic sales numbering, report print templates, private uploads and self-service account controls are connected. Only reviewed posted journals affect ledger balances. No payroll/tax calculation or official submission is claimed.
- Private uploads are stored with metadata in PostgreSQL and included in database dumps. A disposable uploaded PDF survived native dump/restore with matching contents and checksum. Signature checks are not a malware scanner.
- Compatible previous API: `joyno-accounting-api:private-rollback-passwords-20261006` (`dec0a6f1dcbd`). It supports schema 4 and strengthened password hashes and was tested before publishing. Previous source archive is in `/opt/joynoacctg/staging/20261006-verify-05/previous-source.tar.gz`; previous UI is `20261006-private-01`. Do not use a raw older image that cannot verify new password hashes or schema checksums.
- Pre/post-release backups: `joyno-20261006T052357Z-1917958.dump` and `joyno-20261006T052359Z-1918286.dump`. The latter was copied to the Windows PC, encrypted/decrypted and restored into a disposable PostgreSQL database successfully. No fixture records were added to the real company.
- `joynoacctg-health.timer` checks local/public HTTPS API health, container health, backup age/checksum and free disk every 15 minutes. Its first run passed. Failures appear in systemd/journald; no external email/SMS destination is configured.
- Portable PC recovery tools are installed and pass disposable wrong-passphrase/tamper/round-trip checks. Creating a production portable archive requires the owner's hidden passphrase and keeping its archive separately. Actual administrator sign-in and review of company/account mappings likewise need the owner. See `COMPLETION_CHECKLIST.md` and `WINDOWS_BACKUPS.md`.

## Operational checks

```sh
systemctl status joynoacctg-health.timer joynoacctg-health.service joynoacctg-backup.timer
journalctl -u joynoacctg-health.service -u joynoacctg-backup.service --since yesterday
```

The health oneshot being inactive after a successful run is normal; inspect its last exit result and timer. Configure an external notification destination if unattended alerts are needed. No retention deletion is enabled; review disk usage and backup/archive accumulation regularly. Keep SSH keys and recovery passphrases private.

## Connect privately from Windows

The existing key that worked for this server is `roarly_vps`. Do not share its private contents.

```powershell
ssh -i "$env:USERPROFILE\.ssh\roarly_vps" -N -L 127.0.0.1:3002:127.0.0.1:3101 root@187.53.140.168
```

Keep that terminal open, then check `http://127.0.0.1:3002/api/v1/health`. The normal local frontend now uses the domain's HTTPS API without this tunnel. The tunnel remains an optional diagnostic path and does not replace the separate SQLite API on port 3001.
