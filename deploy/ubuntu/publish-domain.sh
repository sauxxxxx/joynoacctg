#!/bin/sh
set -eu
cd /opt/joynoacctg/deploy/ubuntu
release=${1:?Pass a unique release name}
case "$release" in *[!a-zA-Z0-9-]*|'') echo 'Invalid release name.' >&2; exit 1 ;; esac
archive="/opt/joynoacctg/deploy/ubuntu/joyno-web-$release.local.tar.gz"
destination="/var/www/joynoacctg/releases/$release"
site=/etc/nginx/sites-available/joynoacctg
test -f "$archive"
test -f /etc/letsencrypt/live/joynoadmin.tech/fullchain.pem
test ! -e "$destination"
test -f "$site"
test "$(readlink /etc/nginx/sites-enabled/joynoacctg)" = "$site"
if tar -tzf "$archive" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  echo 'Unsafe archive member.' >&2
  exit 1
fi
install -d -m 755 "$destination"
tar -xzf "$archive" -C "$destination"
test -f "$destination/index.html"
chmod -R a+rX "$destination"
if [ -e /var/www/joynoacctg/current ] && [ ! -L /var/www/joynoacctg/current ]; then
  echo 'Current frontend path is not a release symlink.' >&2
  exit 1
fi

# Only this application's environment and vhost are changed. Backups remain root-only.
sh backup.sh
cp -p .env ".env.before-domain-$release.local"
sed -i 's|^JOYNO_CORS_ORIGINS=.*|JOYNO_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://joynoadmin.tech|' .env
if ! grep -q '^JOYNO_CORS_ORIGINS=' .env; then
  echo 'CORS configuration missing; restore the environment backup before retrying.' >&2
  exit 1
fi
docker compose up -d --no-deps api
attempt=0
until curl --fail --silent http://127.0.0.1:3101/api/v1/health >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 15 ]; then echo 'API health failed; HTTPS vhost was not enabled.' >&2; exit 1; fi
  sleep 2
done
ln -s "$destination" "/var/www/joynoacctg/current-$release"
mv -T "/var/www/joynoacctg/current-$release" /var/www/joynoacctg/current
cp -p "$site" "nginx.before-domain-$release.local"
install -m 644 nginx-joynoacctg.conf "$site"
if ! nginx -t; then
  install -m 644 "nginx.before-domain-$release.local" "$site"
  nginx -t
  echo 'New HTTPS config rejected; the prior vhost was restored.' >&2
  exit 1
fi
systemctl reload nginx
curl --fail --show-error --silent --retry 5 --retry-all-errors --retry-delay 1 \
  --resolve joynoadmin.tech:443:127.0.0.1 https://joynoadmin.tech/api/v1/health
echo
echo "Published frontend release: $release"
