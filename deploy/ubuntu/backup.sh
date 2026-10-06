#!/bin/sh
set -eu
umask 077
cd "$(dirname "$0")"

# Run from deploy/ubuntu. Creates a dump only; does not delete/rotate any backups.
# Copy dumps to encrypted off-server storage and test restores separately.
mkdir -p backups
exec 9>backups/.backup.lock
flock -n 9 || { printf 'A database backup is already running.\n' >&2; exit 1; }
backup_file="backups/joyno-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
if docker compose exec -T postgres pg_dump -U joyno_owner -d joyno --format=custom > "$backup_file"; then
  docker compose exec -T postgres pg_restore --list < "$backup_file" > /dev/null
  sha256sum "$backup_file" > "$backup_file.sha256.partial"
  mv "$backup_file.sha256.partial" "$backup_file.sha256"
  printf 'Backup created: %s\n' "$backup_file"
else
  printf 'Backup failed; incomplete dump retained at %s\n' "$backup_file" >&2
  exit 1
fi
