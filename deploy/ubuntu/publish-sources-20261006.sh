#!/bin/sh
set -eu
umask 077
cd /opt/joynoacctg
stage=/opt/joynoacctg/staging/20261006-verify-03
release=/var/www/joynoacctg/releases/20261006-sources-01
previous=/var/www/joynoacctg/releases/20261006-core-01
expected=sha256:72d7dd0d7fc56ed10a70deab22ed834e8503725db5a38891228486ce9b1ca05f
test "$(docker inspect --format '{{.Image}}' joynoacctg-api-1)" = "$expected"
test "$(readlink -f /var/www/joynoacctg/current)" = "$previous"
test -f "$release/index.html"
test ! -e "$stage/previous-source.tar.gz"
docker image inspect joyno-accounting-api:verify-20261006-03 >/dev/null
tar --exclude=server/data -czf "$stage/previous-source.tar.gz" package.json package-lock.json server deploy/ubuntu/compose.yaml
docker tag "$expected" joyno-accounting-api:core-before-sources-20261006
published=false
rollback() {
  if [ "$published" = false ]; then
    docker tag "$expected" joyno-accounting-api:local
    tar -xzf "$stage/previous-source.tar.gz" -C /opt/joynoacctg
    cd /opt/joynoacctg/deploy/ubuntu
    docker compose up -d --no-deps --no-build api
    printf 'Publishing failed. Previous API restored; previous static release remains selected.\n' >&2
  fi
}
trap rollback EXIT
cd deploy/ubuntu
sh backup.sh
cp -a "$stage/server/." /opt/joynoacctg/server/
cp "$stage/package.json" "$stage/package-lock.json" /opt/joynoacctg/
cp "$stage/deploy/ubuntu/compose.yaml" ./compose.yaml
docker tag joyno-accounting-api:verify-20261006-03 joyno-accounting-api:local
docker compose up -d --no-deps --no-build api
attempt=0
until curl --fail --silent http://127.0.0.1:3101/api/v1/health >/dev/null; do
  attempt=$((attempt + 1)); test "$attempt" -lt 20; sleep 1
done
curl --fail --silent http://127.0.0.1:3101/api/v1/openapi.json | grep -q 'sales-documents/bulk'
nginx -t
test ! -e /var/www/joynoacctg/.current-20261006-sources
ln -s "$release" /var/www/joynoacctg/.current-20261006-sources
mv -Tf /var/www/joynoacctg/.current-20261006-sources /var/www/joynoacctg/current
published=true
printf 'Tested source document release published. Database schema unchanged; previous release and pre-release backup preserved.\n'
