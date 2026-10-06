#!/bin/sh
set -eu
umask 077
cd /opt/joynoacctg
stage=/opt/joynoacctg/staging/20261006-verify-04
release=/var/www/joynoacctg/releases/20261006-private-01
previous=/var/www/joynoacctg/releases/20261006-sources-01
expected=sha256:55df0153b0f1eaf9c809f0bcbee6964f012b8c5bd41ca85d2008c349df1bf7b9
test "$(docker inspect --format '{{.Image}}' joynoacctg-api-1)" = "$expected"
test "$(readlink -f /var/www/joynoacctg/current)" = "$previous"
test -f "$release/index.html"
test ! -e "$stage/previous-source.tar.gz"
docker image inspect joyno-accounting-api:verify-20261006-04 >/dev/null
docker image inspect joyno-accounting-api:sources-rollback-schema4-20261006 >/dev/null
tar --exclude=server/data -czf "$stage/previous-source.tar.gz" package.json package-lock.json server deploy/ubuntu/compose.yaml
cp -a /etc/nginx/sites-available/joynoacctg "$stage/previous-nginx.conf"
published=false
rollback() {
  if [ "$published" = false ]; then
    docker tag joyno-accounting-api:sources-rollback-schema4-20261006 joyno-accounting-api:local
    tar -xzf "$stage/previous-source.tar.gz" -C /opt/joynoacctg
    cp "$stage/previous-nginx.conf" /etc/nginx/sites-available/joynoacctg
    nginx -t && systemctl reload nginx
    cd /opt/joynoacctg/deploy/ubuntu
    docker compose up -d --no-deps --no-build api
    printf 'Publishing failed; compatible previous API restored. Additive schema and stored data retained.\n' >&2
  fi
}
trap rollback EXIT
cd deploy/ubuntu
sh backup.sh
docker compose stop api
cp -a "$stage/server/." /opt/joynoacctg/server/
cp "$stage/package.json" "$stage/package-lock.json" /opt/joynoacctg/
cp "$stage/deploy/ubuntu/release-private-20261006.override.yaml" ./
docker compose -f compose.yaml -f release-private-20261006.override.yaml run --rm --no-deps migrate
docker tag joyno-accounting-api:verify-20261006-04 joyno-accounting-api:local
docker compose up -d --no-deps --no-build api
attempt=0
until curl --fail --silent http://127.0.0.1:3101/api/v1/health >/dev/null; do
  attempt=$((attempt + 1)); test "$attempt" -lt 20; sleep 1
done
curl --fail --silent http://127.0.0.1:3101/api/v1/openapi.json | grep -q 'change-password'
cp "$stage/deploy/ubuntu/nginx-joynoacctg.conf" /etc/nginx/sites-available/joynoacctg
nginx -t
systemctl reload nginx
test ! -e /var/www/joynoacctg/.current-20261006-private
ln -s "$release" /var/www/joynoacctg/.current-20261006-private
mv -Tf /var/www/joynoacctg/.current-20261006-private /var/www/joynoacctg/current
published=true
printf 'Private files and self-service release published. Pre-release backup and compatible rollback image preserved.\n'
