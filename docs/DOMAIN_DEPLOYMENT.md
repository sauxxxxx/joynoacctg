# joynoadmin.tech

Initially deployed 5 October, updated 6 October 2026 (Asia/Manila). This is the same Vue app and PostgreSQL backend used by the local preview, not a second accounting system. Normal sessions use real records; sample adapters are test-only.

## Topology

- DNS: root A record to `187.53.140.168`, `www` CNAME to the root; stale AAAA removed by the user.
- HTTP redirects to `https://joynoadmin.tech`; `www` redirects to that same root.
- Nginx serves the built Vue frontend from `/var/www/joynoacctg/current`.
- `/api/v1/` proxies to host `127.0.0.1:3101`, preserving the path. Forwarded client headers are overwritten; the API trusts one proxy hop.
- API and PostgreSQL containers, roles, memberships, and administrator are unchanged. PostgreSQL has no published port; the API host port stays loopback-only.
- Production build uses same-origin `/api/v1` without environment secrets. Local Vite forwards `/vps-api` to the domain's HTTPS API with certificate verification.
- Sign in as `admin` using the private password chosen during VPS bootstrap. No admin password was reset or uploaded.

## Files and renewal

The new accounting Nginx vhost is `/etc/nginx/sites-available/joynoacctg`, linked from `sites-enabled`. Other sites were not overwritten. `deploy/ubuntu/nginx-joynoacctg.conf` is its source template. `nginx-domain-bootstrap.conf` serves only certificate challenges until TLS is ready.

Certbot's webroot is `/var/www/joynoacctg/acme`; the HTTPS configuration retains its HTTP challenge route. The certificate covers the root and `www` and lives at `/etc/letsencrypt/live/joynoadmin.tech`. Renewal uses Certbot's existing scheduled timer. `reload-web.sh` validates/reloads Nginx only when this certificate renews, without restarting the database.

References: [Certbot webroot and renewal](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot), [Nginx reverse proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass).

## Future releases and rollback

6 October report update: `current` points to `20261006-reports-01`, API image `d702b40b137b` (`:local` and `:verify-20261006-05`), schema 1–4. Native PostgreSQL and restored-copy startup/file recovery passed before publishing. Compatible previous API tag `joyno-accounting-api:private-rollback-passwords-20261006` (`dec0a6f1dcbd`) supports schema 4 and new password hashes. Raw older images may reject the schema or new hashes. Previous UI is `20261006-private-01`; source backup is in `/opt/joynoacctg/staging/20261006-verify-05/previous-source.tar.gz`. Frontend rollback is separate; do not overwrite later user records to roll back code.

Build and test locally, package ONLY `dist/` into a uniquely named `joyno-web-<release>.local.tar.gz`, and upload it beside `publish-domain.sh`. Inspect the target and existing deployment first. Run `sh publish-domain.sh <release>` on the VPS; it rejects an existing release directory, backs up the database and environment, recreates only the API if its origin configuration changes, and validates Nginx before reload. It does not run migrations or remove volumes.

The initial domain release was `20261005-domain-01`. Its environment/vhost backups remain root-only; reverting to its pre-domain HTTP vhost disables hosted access. The current HTTPS vhost retains certificate challenges and restricts uploaded files to authenticated API downloads. Validate Nginx before reload and do not replace unrelated vhosts.

Frontend rollback can repoint `current` to an explicitly verified compatible prior release. Versioned older UI assets are retained for open browser sessions. Retained backups/releases need an agreed retention policy; no automatic removal is configured. Historical one-off publishing scripts check exact prior images/releases and must not be rerun blindly.

## Outstanding

Verification passed: public HTTPS with certificate validation, HTTP and `www` redirects, real hosted login rendering with no console errors, same-origin PostgreSQL health, and 401 for unauthenticated document/report/account reads. Actual administrator sign-in still needs the private owner password. Certbot renewal dry run succeeded and its timer is active. Current checks include 53 frontend tests, 37 local backend tests, an additional native PostgreSQL test, lint/type-check/build, and restore tests. One-year HSTS applies to the accounting host without including other subdomains. Header verification retries during asynchronous Nginx worker handover.

Company administration, journals, financial reporting, tax/payroll tracking, sales/purchase sources/allocations, banking, assets, private files, self-service accounts, saved report templates and numbering are connected. Nightly server backups and encrypted Windows PC copies passed post-release restore checks. A periodic health timer records failures locally; external alerts and mail hosting are not configured. The owner still needs to verify their private admin login and create/store a portable recovery archive. The domain's MX record targets its root; no email service was installed on this VPS.
