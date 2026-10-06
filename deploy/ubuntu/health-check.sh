#!/bin/sh
# Read-only operational checks for this accounting deployment only.
set -eu
cd /opt/joynoacctg/deploy/ubuntu
curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3101/api/v1/health >/dev/null
curl --fail --silent --show-error --max-time 20 https://joynoadmin.tech/api/v1/health >/dev/null
for container in joynoacctg-api-1 joynoacctg-postgres-1; do
  test "$(docker inspect --format '{{.State.Health.Status}}' "$container")" = healthy
done
systemctl is-active --quiet joynoacctg-backup.timer
latest="$(find backups -maxdepth 1 -type f -name 'joyno-*.dump.sha256' -printf '%f\n' | sort | tail -n 1)"
test -n "$latest"
sha256sum --check --status "backups/$latest"
age="$(( $(date +%s) - $(stat -c %Y "backups/$latest") ))"
test "$age" -ge 0 && test "$age" -lt 129600
available="$(df -Pk /opt/joynoacctg | awk 'NR==2 {print $4}')"
test "$available" -gt 2097152
printf 'Accounting API, HTTPS, containers, backup age/checksum and free disk checks passed.\n'
