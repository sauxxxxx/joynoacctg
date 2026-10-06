#!/bin/sh
set -eu
umask 077
cd /opt/joynoacctg
stage=/opt/joynoacctg/staging/20261006-verify-02
release=/var/www/joynoacctg/releases/20261006-core-01
previous=/var/www/joynoacctg/releases/20261005-domain-01
expected=sha256:9d8cf112d88c3a6aa0a4b16e506c1f7ea61a6645bde79f671d343e4840cc3d21
test "$(docker inspect --format '{{.Image}}' joynoacctg-api-1)" = "$expected"
test "$(readlink -f /var/www/joynoacctg/current)" = "$previous"
test -f "$release/index.html"
test ! -e "$stage/previous-source.tar.gz"
docker image inspect joyno-accounting-api:verify-20261006-02 >/dev/null
tar --exclude=server/data -czf "$stage/previous-source.tar.gz" package.json package-lock.json server
docker tag "$expected" joyno-accounting-api:foundation-20261005-preserved
cd deploy/ubuntu
sh backup.sh
docker compose -f compose.yaml -f release-20261006.override.yaml run --rm --no-deps migrate
cp -a "$stage/server/." /opt/joynoacctg/server/
cp "$stage/package.json" "$stage/package-lock.json" /opt/joynoacctg/
docker tag joyno-accounting-api:verify-20261006-02 joyno-accounting-api:local
docker compose up -d --no-deps --no-build api
attempt=0
until curl --fail --silent http://127.0.0.1:3101/api/v1/health >/dev/null; do
  attempt=$((attempt + 1))
  test "$attempt" -lt 20
  sleep 1
done
curl --fail --silent http://127.0.0.1:3101/api/v1/openapi.json | grep -q 'bank-transactions/create-journals'
nginx -t
test ! -e /var/www/joynoacctg/.current-20261006-core
ln -s "$release" /var/www/joynoacctg/.current-20261006-core
mv -Tf /var/www/joynoacctg/.current-20261006-core /var/www/joynoacctg/current
printf 'Tested accounting core published. Previous source, image, static release and database backups preserved.\n'
