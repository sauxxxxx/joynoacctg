#!/bin/sh
set -eu
cd /opt/joynoacctg/deploy/ubuntu
site=/etc/nginx/sites-available/joynoacctg
enabled=/etc/nginx/sites-enabled/joynoacctg
if [ -e "$site" ] || [ -L "$enabled" ]; then
  echo 'Accounting vhost already exists; refusing to replace it during bootstrap.' >&2
  exit 1
fi
install -d -m 755 /var/www/joynoacctg/acme/.well-known/acme-challenge /var/www/joynoacctg/releases
install -m 644 nginx-domain-bootstrap.conf "$site"
ln -s "$site" "$enabled"
if ! nginx -t; then
  # Remove only the two new vhost entries created above; no existing sites are touched.
  unlink "$enabled"
  rm "$site"
  exit 1
fi
systemctl reload nginx
certbot certonly --webroot -w /var/www/joynoacctg/acme \
  --cert-name joynoadmin.tech -d joynoadmin.tech -d www.joynoadmin.tech \
  --non-interactive --agree-tos --keep-until-expiring \
  --deploy-hook 'sh /opt/joynoacctg/deploy/ubuntu/reload-web.sh'
