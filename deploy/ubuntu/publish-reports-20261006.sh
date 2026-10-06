#!/bin/sh
set -eu
umask 077
cd /opt/joynoacctg
stage=/opt/joynoacctg/staging/20261006-verify-05
release=/var/www/joynoacctg/releases/20261006-reports-01
previous=/var/www/joynoacctg/releases/20261006-private-01
expected=sha256:74e8f33291c68705288c63205fde17a1538f3ec9744e84c19a083646ef4d71e1
test "$(docker inspect --format '{{.Image}}' joynoacctg-api-1)" = "$expected"
test "$(readlink -f /var/www/joynoacctg/current)" = "$previous"
test -f "$release/index.html"
test ! -e "$stage/previous-source.tar.gz"
docker image inspect joyno-accounting-api:verify-20261006-05 >/dev/null
docker image inspect joyno-accounting-api:private-rollback-passwords-20261006 >/dev/null
tar --exclude=server/data -czf "$stage/previous-source.tar.gz" package.json package-lock.json server deploy/ubuntu/compose.yaml
published=false
switched=false
rollback() {
  if [ "$published" = false ]; then
    docker tag joyno-accounting-api:private-rollback-passwords-20261006 joyno-accounting-api:local
    tar -xzf "$stage/previous-source.tar.gz" -C /opt/joynoacctg
    cp "$stage/server/security/passwords.js" /opt/joynoacctg/server/security/passwords.js
    if [ "$switched" = true ]; then
      ln -s "$previous" /var/www/joynoacctg/.rollback-reports-20261006
      mv -Tf /var/www/joynoacctg/.rollback-reports-20261006 /var/www/joynoacctg/current
    fi
    cd /opt/joynoacctg/deploy/ubuntu
    docker compose up -d --no-deps --no-build api
    printf 'Previous compatible API/UI restored; stored data retained.\n' >&2
  fi
}
trap rollback EXIT
cd deploy/ubuntu
sh backup.sh
docker compose stop api
cp -a "$stage/server/." /opt/joynoacctg/server/
cp "$stage/package.json" "$stage/package-lock.json" /opt/joynoacctg/
docker tag joyno-accounting-api:verify-20261006-05 joyno-accounting-api:local
docker compose up -d --no-deps --no-build api
attempt=0
until curl --fail --silent http://127.0.0.1:3101/api/v1/health >/dev/null; do
  attempt=$((attempt + 1)); test "$attempt" -lt 20; sleep 1
done
curl --fail --silent http://127.0.0.1:3101/api/v1/openapi.json | grep -q 'posted-books'
test ! -e /var/www/joynoacctg/.current-reports-20261006
ln -s "$release" /var/www/joynoacctg/.current-reports-20261006
mv -Tf /var/www/joynoacctg/.current-reports-20261006 /var/www/joynoacctg/current
switched=true
curl --fail --silent https://joynoadmin.tech/api/v1/health >/dev/null
published=true
sh backup.sh
printf 'Report release published with pre/post backups and compatible rollback preserved.\n'
