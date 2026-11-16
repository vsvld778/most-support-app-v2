#!/usr/bin/env bash
# The caller must put the reviewed source revision in /opt/most-support-app-v2 first.
set -euo pipefail
umask 022
[[ $(id -u) == 0 ]] || { echo 'Run as root.' >&2; exit 1; }
APP_ROOT=/opt/most-support-app-v2
[[ -f /etc/most-support-v2/app.env ]] || { echo 'Run install.sh first.' >&2; exit 1; }
bash "$APP_ROOT/deploy/backup.sh"
"$APP_ROOT/.venv/bin/pip" install --disable-pip-version-check -r "$APP_ROOT/backend/requirements.txt"
chown -R root:root "$APP_ROOT/backend" "$APP_ROOT/.venv"
chmod -R a+rX "$APP_ROOT/.venv"
find "$APP_ROOT/backend" -type d -exec chmod 0755 {} +
find "$APP_ROOT/backend" -type f -exec chmod 0644 {} +
runuser -u mostv2 -- test -r "$APP_ROOT/backend/config/settings.py"
runuser -u mostv2 -- "$APP_ROOT/.venv/bin/python" -c 'import django, gunicorn, psycopg'
bash "$APP_ROOT/deploy/manage.sh" migrate --noinput
bash "$APP_ROOT/deploy/manage.sh" collectstatic --noinput
find /var/lib/most-support-v2/static -type d -exec chmod 0755 {} +
find /var/lib/most-support-v2/static -type f -exec chmod 0644 {} +
chgrp -R www-data /var/lib/most-support-v2/static
python3 "$APP_ROOT/tools/build-static.py"
rsync -a --chmod=D755,F644 "$APP_ROOT/docs/" /var/www/most-support-v2/app/
bash "$APP_ROOT/deploy/manage.sh" check --deploy
systemctl restart most-support-v2
APP_HOST=$(cat /etc/most-support-v2/host)
curl --retry 8 --retry-connrefused --retry-delay 1 --fail --silent --show-error "https://$APP_HOST/health/"
echo
