#!/bin/sh
set -eu
cd /opt/joynoacctg/deploy/ubuntu
backup_name="${1:?Pass a completed backup filename}"
release_override="${2:-release-20261006.override.yaml}"
case "$release_override" in release-20261006.override.yaml|release-sources-20261006.override.yaml|release-private-20261006.override.yaml|release-reports-20261006.override.yaml) ;; *) exit 2 ;; esac
printf '%s' "$backup_name" | grep -Eq '^joyno-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$'
sha256sum --check --status "backups/$backup_name.sha256"
verify_database="joyno_startup_$(openssl rand -hex 16)"
verify_container="joynoacctg-startup-$(openssl rand -hex 8)"
created=false
started=false
cleanup() {
  if [ "$started" = true ]; then docker stop "$verify_container" >/dev/null; fi
  if [ "$created" = true ]; then docker compose exec -T postgres dropdb -U joyno_owner "$verify_database"; fi
}
trap cleanup EXIT
docker compose exec -T postgres createdb -U joyno_owner "$verify_database"
created=true
docker compose exec -T postgres pg_restore -U joyno_owner --dbname="$verify_database" --exit-on-error < "backups/$backup_name"
docker compose -f compose.yaml -f "$release_override" run --rm --no-deps -e JOYNO_DB_NAME="$verify_database" migrate
docker compose -f compose.yaml -f "$release_override" run --rm -d --no-deps --name "$verify_container" --publish 127.0.0.1:3102:3001 -e JOYNO_DB_NAME="$verify_database" api >/dev/null
started=true
attempt=0
until curl --fail --silent http://127.0.0.1:3102/api/v1/health >/dev/null; do
  attempt=$((attempt + 1))
  test "$attempt" -lt 20
  sleep 1
done
curl --fail --silent http://127.0.0.1:3102/api/v1/health | grep -q '"database":"postgres"'
status="$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3102/api/v1/companies/22571264-b1c7-4a0a-b23a-7b405822436c/accounts)"
test "$status" = 401
curl --fail --silent http://127.0.0.1:3102/api/v1/openapi.json | grep -q 'bank-transactions/create-journals'
if [ "$release_override" = release-private-20261006.override.yaml ]; then
  docker stop "$verify_container" >/dev/null
  started=false
  docker compose -f compose.yaml -f release-rollback-private-20261006.override.yaml run --rm -d --no-deps --name "$verify_container" --publish 127.0.0.1:3102:3001 -e JOYNO_DB_NAME="$verify_database" api >/dev/null
  started=true
  attempt=0
  until curl --fail --silent http://127.0.0.1:3102/api/v1/health >/dev/null; do
    attempt=$((attempt + 1)); test "$attempt" -lt 20; sleep 1
  done
  printf 'Preserved source-release rollback API also starts successfully on schema 4.\n'
fi
if [ "$release_override" = release-reports-20261006.override.yaml ]; then
  curl --fail --silent http://127.0.0.1:3102/api/v1/openapi.json | grep -q 'posted-books'
  docker stop "$verify_container" >/dev/null
  started=false
  docker compose -f compose.yaml -f release-rollback-reports-20261006.override.yaml run --rm -d --no-deps --name "$verify_container" --publish 127.0.0.1:3102:3001 -e JOYNO_DB_NAME="$verify_database" api >/dev/null
  started=true
  attempt=0
  until curl --fail --silent http://127.0.0.1:3102/api/v1/health >/dev/null; do
    attempt=$((attempt + 1)); test "$attempt" -lt 20; sleep 1
  done
  printf 'Preserved private-release rollback API starts successfully on schema 4.\n'
fi
printf 'API startup, PostgreSQL runtime permissions and unauthenticated rejection verified on a restored copy.\n'
