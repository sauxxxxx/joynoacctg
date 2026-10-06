#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  printf 'Usage: sh restore-check.sh backups/existing-backup.dump\n' >&2
  exit 1
fi
restore_database="joyno_restore_$(openssl rand -hex 16)"
created=false
cleanup() {
  if [ "$created" = true ]; then
    docker compose exec -T postgres dropdb -U joyno_owner "$restore_database"
  fi
}
trap cleanup EXIT
docker compose exec -T postgres createdb -U joyno_owner "$restore_database"
created=true
docker compose exec -T postgres pg_restore -U joyno_owner --dbname="$restore_database" --exit-on-error < "$1"
migration_count="$(docker compose exec -T postgres psql -U joyno_owner -d "$restore_database" -Atc 'SELECT count(*) FROM schema_migrations')"
test "$migration_count" -ge 1
printf 'Backup restored and migration metadata checked in a disposable database.\n'
