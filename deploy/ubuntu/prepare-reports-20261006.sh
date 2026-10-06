#!/bin/sh
set -eu
umask 077
stage=/opt/joynoacctg/staging/20261006-verify-05
release=/var/www/joynoacctg/releases/20261006-reports-01
test ! -e "$stage"
test ! -e "$release"
mkdir -p "$stage" "$release"
tar -xzf /tmp/joyno-source-20261006-verify-05.tar.gz -C "$stage"
tar -xzf /tmp/joyno-web-20261006-reports-01.tar.gz -C "$release"
# Preserve earlier lazy-loaded assets for browsers already open; never replace new assets.
cp -an /var/www/joynoacctg/current/assets/. "$release/assets/"
chmod -R a+rX "$release"
cd "$stage"
docker build -t joyno-accounting-api:verify-20261006-05 -f deploy/ubuntu/Dockerfile .
docker build -t joyno-accounting-api:private-rollback-passwords-20261006 -f deploy/ubuntu/rollback/Dockerfile.private .
docker run --rm --read-only --network none --mount "type=bind,src=$stage/server/tests/passwords.test.js,dst=/app/server/tests/passwords.test.js,readonly" joyno-accounting-api:private-rollback-passwords-20261006 node --test server/tests/passwords.test.js
cd /opt/joynoacctg/deploy/ubuntu
for file in release-reports-20261006.override.yaml release-rollback-reports-20261006.override.yaml verify-startup.sh verify-file-recovery.sh; do
  cp "$stage/deploy/ubuntu/$file" "./$file"
done
docker compose -f compose.yaml -f release-reports-20261006.override.yaml run --rm --no-deps migrate node server/cli/verifyPostgres.js
sh verify-startup.sh joyno-20261006T045817Z-1907854.dump release-reports-20261006.override.yaml
sh verify-file-recovery.sh
printf 'Report release and password-compatible rollback verified before publishing.\n'
