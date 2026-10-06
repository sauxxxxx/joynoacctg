# Transitional rollback only: the previous source release with a schema-3/4 verifier.
# Migration 4 is additive. Uploaded contents are retained if this image is selected.
FROM joyno-accounting-api:verify-20261006-03
COPY --chown=node:node deploy/ubuntu/rollback/migratePostgres.js /app/server/db/migratePostgres.js
COPY --chown=node:node server/db/migrations/004_documents.sql /app/server/db/migrations/004_documents.sql
