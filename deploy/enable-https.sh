#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root.' >&2; exit 1; }
APP_ROOT=/opt/most-support-app-v2
APP_HOST=$(cat /etc/most-support-v2/host)
[[ -s /etc/letsencrypt/live/$APP_HOST/fullchain.pem && -s /etc/letsencrypt/live/$APP_HOST/privkey.pem ]] || { echo 'Obtain the certificate first.' >&2; exit 1; }
cp -p /etc/nginx/sites-available/most-support-v2 /etc/nginx/sites-available/most-support-v2.previous
python3 - "$APP_ROOT/deploy/nginx/application.conf" "$APP_HOST" <<'PY'
from pathlib import Path
import sys
Path('/etc/nginx/sites-available/most-support-v2').write_text(Path(sys.argv[1]).read_text().replace('__APP_HOST__',sys.argv[2]))
PY
if ! nginx -t; then
  mv /etc/nginx/sites-available/most-support-v2.previous /etc/nginx/sites-available/most-support-v2
  echo 'Invalid Nginx configuration; restored the previous file.' >&2
  exit 1
fi
systemctl reload nginx
install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/most-support-v2 <<'SH'
#!/bin/sh
set -eu
/usr/sbin/nginx -t
/bin/systemctl reload nginx
SH
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/most-support-v2
systemctl enable --now certbot.timer
curl --fail --silent --show-error "https://$APP_HOST/health/"
echo
echo "Application: https://$APP_HOST/app/"
echo 'Registration is still closed. Create the administrator interactively with deploy/manage.sh createsuperuser.'
