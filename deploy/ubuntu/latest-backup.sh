#!/bin/sh
set -eu
cd "$(dirname "$0")"
# Only completed dumps have checksum sidecars. No paths supplied by clients.
latest="$(find backups -maxdepth 1 -type f -name 'joyno-*.dump.sha256' -printf '%f\n' | LC_ALL=C sort | tail -n 1)"
if [ -z "$latest" ]; then
  printf 'No completed backup is available.\n' >&2
  exit 1
fi
case "$latest" in
  *[!a-zA-Z0-9.-]*) printf 'Invalid backup name.\n' >&2; exit 1 ;;
esac
sha256sum --check --status "backups/$latest"
cat "backups/$latest"
