#!/bin/sh
set -eu
umask 077
candidate=/tmp/joynoacctg-nginx-hsts-20261006.conf
target=/etc/nginx/sites-available/joynoacctg
backup=/opt/joynoacctg/staging/20261006-verify-05/nginx.before-hsts-retry.conf
test -f "$candidate"
test -f "$target"
test ! -e "$backup"
cp -a "$target" "$backup"
applied=false
rollback() {
  if [ "$applied" = false ]; then
    cp "$backup" "$target"
    nginx -t && systemctl reload nginx
  fi
}
trap rollback EXIT
cp "$candidate" "$target"
nginx -t
systemctl reload nginx
attempt=0
until curl --fail --silent --head https://joynoadmin.tech/api/v1/health | grep -qi 'strict-transport-security: max-age=31536000'; do
  attempt=$((attempt + 1)); test "$attempt" -lt 10; sleep 1
done
cp "$candidate" /opt/joynoacctg/deploy/ubuntu/nginx-joynoacctg.conf
applied=true
printf 'HTTPS-only browser policy enabled for the accounting domain; other sites unchanged.\n'
