#!/bin/sh
set -eu
cd /opt/joynoacctg/deploy/ubuntu
backup_name="${1:?Pass a completed backup filename}"
printf '%s' "$backup_name" | grep -Eq '^joyno-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$'
backup_file="backups/$backup_name"
test -f "$backup_file"
sha256sum --check --status "$backup_file.sha256"
restore_database="joyno_migration_$(openssl rand -hex 16)"
created=false
cleanup() {
  if [ "$created" = true ]; then docker compose exec -T postgres dropdb -U joyno_owner "$restore_database"; fi
}
trap cleanup EXIT
docker compose exec -T postgres createdb -U joyno_owner "$restore_database"
created=true
docker compose exec -T postgres pg_restore -U joyno_owner --dbname="$restore_database" --exit-on-error < "$backup_file"
counts_query='SELECT (SELECT count(*) FROM companies), (SELECT count(*) FROM users), (SELECT count(*) FROM roles), (SELECT count(*) FROM company_memberships), (SELECT count(*) FROM accounts), (SELECT count(*) FROM account_categories), (SELECT count(*) FROM sessions), (SELECT count(*) FROM audit_events)'
before="$(docker compose exec -T postgres psql -U joyno_owner -d "$restore_database" -Atc "$counts_query")"
docker compose -f compose.yaml -f verify-release.override.yaml run --rm --no-deps -e JOYNO_DB_NAME="$restore_database" migrate
after="$(docker compose exec -T postgres psql -U joyno_owner -d "$restore_database" -Atc "$counts_query")"
test "$before" = "$after"
versions="$(docker compose exec -T postgres psql -U joyno_owner -d "$restore_database" -Atc 'SELECT count(*) FROM schema_migrations')"
test "$versions" -eq 3
printf 'Migrations verified on a restored copy. Existing row counts preserved. Live company unchanged.\n'
