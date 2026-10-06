#!/bin/sh
set -eu
# Deploy hook affects Nginx only for this certificate; it never restarts the database.
if [ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/joynoadmin.tech ]; then
  nginx -t
  systemctl reload nginx
fi
