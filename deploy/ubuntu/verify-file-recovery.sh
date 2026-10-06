#!/bin/sh
set -eu
umask 077
cd /opt/joynoacctg/deploy/ubuntu
source_database="joyno_filesverify_$(openssl rand -hex 16)"
restore_database="joyno_filesverify_$(openssl rand -hex 16)"
archive="/opt/joynoacctg/staging/20261006-verify-05/files-recovery-$(openssl rand -hex 16).dump"
source_created=false
restore_created=false
cleanup() {
  if [ "$source_created" = true ]; then docker compose exec -T postgres dropdb -U joyno_owner "$source_database"; fi
  if [ "$restore_created" = true ]; then docker compose exec -T postgres dropdb -U joyno_owner "$restore_database"; fi
  if [ -f "$archive" ]; then rm -f -- "$archive"; fi
}
trap cleanup EXIT
docker compose exec -T postgres createdb -U joyno_owner "$source_database"
source_created=true
docker compose -f compose.yaml -f release-reports-20261006.override.yaml run --rm --no-deps -e JOYNO_DB_NAME="$source_database" migrate
docker compose -f compose.yaml -f release-reports-20261006.override.yaml run --rm --no-deps -e JOYNO_DB_NAME="$source_database" migrate node server/tests/documentRecoveryFixture.js seed
docker compose exec -T postgres pg_dump -U joyno_owner --format=custom "$source_database" > "$archive"
docker compose exec -T postgres createdb -U joyno_owner "$restore_database"
restore_created=true
docker compose exec -T postgres pg_restore -U joyno_owner --dbname="$restore_database" --exit-on-error < "$archive"
docker compose -f compose.yaml -f release-reports-20261006.override.yaml run --rm --no-deps -e JOYNO_DB_NAME="$restore_database" migrate node server/tests/documentRecoveryFixture.js verify
printf 'Uploaded file recovered from a native PostgreSQL dump with matching bytes/checksum. Live data untouched.\n'
