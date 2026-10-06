#!/bin/sh
set -eu

# The official PostgreSQL entrypoint runs this only on an empty data volume.
# Separate migration owner from the API role; no public database port is published.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 \
  --set=runtime_password="$JOYNO_APP_DB_PASSWORD" <<'SQL'
CREATE ROLE joyno_app LOGIN PASSWORD :'runtime_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE joyno TO joyno_app;
SQL
