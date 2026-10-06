#!/bin/sh
set -eu
cd "$(dirname "$0")"

# First-time setup only: never replace credentials for an existing database.
if [ -e .env ]; then
  printf '.env already exists. Review the existing deployment; this script will not overwrite it.\n' >&2
  exit 1
fi
if [ -n "$(docker ps -a --filter label=com.docker.compose.project=joynoacctg --format '{{.Names}}')" ] ||
   [ -n "$(docker volume ls --filter label=com.docker.compose.project=joynoacctg --format '{{.Name}}')" ]; then
  printf 'An accounting project or volume already exists. Review it before provisioning.\n' >&2
  exit 1
fi
umask 077
owner_password="$(openssl rand -hex 32)"
runtime_password="$(openssl rand -hex 32)"
printf 'JOYNO_OWNER_DB_PASSWORD=%s\nJOYNO_APP_DB_PASSWORD=%s\nJOYNO_HOST_API_PORT=3101\nJOYNO_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173\n' \
  "$owner_password" "$runtime_password" > .env
unset owner_password runtime_password
docker compose config --quiet
docker compose build api
docker compose up -d postgres
docker compose run --rm migrate
docker compose up -d api
