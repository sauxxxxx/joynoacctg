# Ubuntu KVM 4 deployment preparation

## Scope and current status

Target: Vue frontend -> Node API -> PostgreSQL on the existing Ubuntu VPS. Supabase is not required.

The code supports PostgreSQL for the implemented foundation: sign-in/out, company memberships, permissions, account categories, accounts, optimistic versions, and transactional audit events. Journals/posting, sales/purchases, company administration, and the full report wiring are NOT complete. Do not use this foundation for live accounting yet.

Local preview remains unchanged. Local SQLite data in `server/data/joyno.sqlite` is preserved and is not automatically migrated. PostgreSQL starts with its own empty database and requires a new bootstrap. Choose a fresh production admin password; do not reuse a password shared in chat.

The private foundation is now deployed; see [current VPS status](KVM4_STATUS.md). Before future deployment changes, confirm SSH access, existing services/databases, ports, available disk, domain/DNS, backup destination, and restore plan. Do not overwrite an existing Caddy/Nginx configuration or stop other applications.

## Prepared topology

- Docker Compose runs PostgreSQL 17 and the Node 24 API.
- PostgreSQL has a named persistent volume and NO published host port.
- The API uses a restricted `joyno_app` database role, not the database owner.
- API port 3001 is published only on host loopback. Change `JOYNO_HOST_API_PORT` if another service uses it.
- A host Caddy/Nginx reverse proxy may expose the API over HTTPS after domain/security review. Only SSH and HTTP/HTTPS need public access; do not open PostgreSQL/3001.
- Migrations use a separate database owner. Runtime cannot create/drop tables, change migration records, or update/delete audit events.
- The provided Compose uses one trusted proxy hop because only the loopback host can reach the API. Revisit `JOYNO_TRUST_PROXY` if proxy topology changes. An unrestricted public API must not blindly trust forwarded headers.

The template deploys the backend ONLY. Keep the frontend local until the remaining endpoints are implemented. Do not enable `VITE_API_BASE_URL` globally yet: several repositories target endpoints that this foundation does not provide.

## Preparation on Ubuntu (after access and service review)

Use a dedicated checkout/release directory. Install Docker Engine and the Compose plugin using the official Ubuntu instructions if they are not already available. Do not replace an existing deployment tool without review. The commands below are examples, not actions already performed.

From the checkout root:

```sh
cd deploy/ubuntu
cp .env.example .env
chmod 600 .env
```

Edit `.env` privately. Replace both password placeholders with different strong random passwords. Keep credentials out of Git, chat, shell history, screenshots, and command output. The owner and runtime passwords are separate from the app administrator password. Do not share the output of `docker compose config`: it includes interpolated secrets.

For now keep local origins. Later add the exact HTTPS frontend origin to `JOYNO_CORS_ORIGINS`; no wildcard is needed. Backend variables must never use the frontend `VITE_` prefix.

## Start the database, migrate, then start the API

Before running this on an existing server, check for the `joynoacctg` Compose project/volume and confirm it is the intended target. Never run `docker compose down -v` against accounting data.

```sh
docker compose build api
docker compose up -d postgres
docker compose run --rm migrate
docker compose up -d api
docker compose ps
curl --fail http://127.0.0.1:3001/api/v1/health
```

The migration runner takes a transaction-scoped advisory lock and checks immutable migration checksums. API startup checks schema compatibility; production does NOT automatically migrate. `init-runtime-role.sh` runs only for a new PostgreSQL data volume. If existing data is present, provision/verify the runtime role explicitly; do not reset the volume. Changing `.env` does not rotate an existing PostgreSQL role password.

## Bootstrap a new administrator once

In Bash, from `deploy/ubuntu`, use a hidden prompt (password is not recorded as a typed shell command):

```bash
export JOYNO_ADMIN_USERNAME=admin
export JOYNO_COMPANY_NAME=Joyno
read -r -s -p 'Choose a NEW admin password (12-128 characters): ' JOYNO_ADMIN_PASSWORD
printf '\n'
export JOYNO_ADMIN_PASSWORD
docker compose run --rm -e JOYNO_ADMIN_USERNAME -e JOYNO_COMPANY_NAME -e JOYNO_ADMIN_PASSWORD api node server/cli/bootstrap.js
unset JOYNO_ADMIN_PASSWORD
```

Bootstrap refuses a database that already has users. It does not reset users or import SQLite. Passwords are scrypt-hashed; sessions use random tokens with only token hashes stored. Do not add a public bootstrap endpoint.

## Private development access before public hosting

From Windows, establish an SSH tunnel with your actual SSH user and hostname:

```powershell
ssh -N -L 3002:127.0.0.1:3001 your-user@your-vps-host
```

Then the remote API is reachable at `http://127.0.0.1:3002/api/v1/health`. This does not replace or stop the local API on port 3001, and the local frontend stays in preview. Do not send private SSH keys or server passwords in chat.

For a completely new accounting deployment, `prepare-private.sh` generates database passwords privately and selects host loopback port **3101** to avoid Joyno HR on port 3001. It refuses existing accounting projects, volumes, and `.env` files. If using that script, change the SSH tunnel target to `3002:127.0.0.1:3101`. The source directory used on this VPS is `/opt/joynoacctg`; keep it separate from `/opt/joyno-hr`.

After migration, native PostgreSQL verification can be run with owner credentials without touching the application tables:

```sh
docker compose run --rm migrate node server/cli/verifyPostgres.js
```

This creates a uniquely named disposable verification database, runs the real pool/concurrent-edit test there, and removes only that test database afterward. It never points the test at the accounting database. Keep production admin bootstrap as a separate hidden-password prompt step.

## HTTPS and public exposure (separate reviewed step)

Use the existing VPS reverse proxy if present. `Caddyfile.example` is an API-only example, not a replacement for a current configuration. Replace its hostname, point DNS to the VPS, validate the proxy configuration, and enable HTTPS before accepting public sign-ins. Keep database/API host ports private. Apply access restrictions while the foundation is incomplete.

## Backups and recovery

```sh
sh backup.sh
```

The script creates a private custom-format `pg_dump` in `deploy/ubuntu/backups` and checks its archive directory. It does not delete/rotate old backups. This archive check is NOT a restore test. Upload encrypted copies to separate off-server storage, monitor backup failures and disk usage, agree retention, and test `pg_restore` into a separate disposable database. Add scheduled backup automation only after the destination/credentials/retention are agreed. For tighter recovery targets, plan PostgreSQL WAL archiving/PITR. VPS snapshots alone are not the recovery plan.

`sh restore-check.sh backups/<exact-backup-filename>.dump` restores the selected archive into a newly generated disposable database, checks migration metadata, and drops only that test database. It does not restore over the accounting database.

Before each release: take and verify a backup, test migrations on a restored copy, apply reviewed migrations, then recreate the API. Use the prior application image for rollback only if its schema is compatible; never attempt an unreviewed destructive schema rollback.

## Verification and limitations

```powershell
npm.cmd run api:test
npm.cmd run test:run
npm.cmd run lint
npm.cmd run build
```

Normal tests cover SQLite and PGlite PostgreSQL SQL/schema/API behavior. Set `JOYNO_TEST_DATABASE_URL` privately to an isolated native PostgreSQL test database to enable the real pool/concurrent-edit test. It creates/removes only a uniquely named test schema; it never truncates existing application tables. Never point it at the accounting production database.

Docker image builds, Compose startup, native PostgreSQL networking/concurrent edits, and an initial disposable backup restore were verified on the VPS; see [current VPS status](KVM4_STATUS.md). Public TLS/DNS, off-site backup storage, scheduled backups, and a complete recovery plan remain pending. For production, review/pin container image digests and establish patching, monitoring, alerts, disk thresholds, and session cleanup. Sign-in limiting is currently process-local; multiple API instances need a shared limiter.

## Configuration reference

`JOYNO_DB_DRIVER=postgres`; supply either `JOYNO_DATABASE_URL` or the individual `JOYNO_DB_HOST`, `JOYNO_DB_PORT`, `JOYNO_DB_NAME`, `JOYNO_DB_USER`, and `JOYNO_DB_PASSWORD` variables. The Compose template uses individual fields, so passwords need not be URL-encoded. TLS is not used between containers on the same host-only Docker network; remote database connections should use `JOYNO_DATABASE_SSL=true` and a trusted CA file through `JOYNO_DATABASE_CA` where needed. Do not disable certificate verification.

Server scripts read process environment variables. They do not automatically load `.env`; Compose reads `deploy/ubuntu/.env` and passes only the declared variables to each container.

References: [Docker on Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [Compose production guidance](https://docs.docker.com/compose/how-tos/production/), [PostgreSQL backups](https://www.postgresql.org/docs/current/backup.html), [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).
