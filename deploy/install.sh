#!/usr/bin/env bash
# First installation on a NEW, dedicated Ubuntu 24.04 VPS. Does not obtain TLS
# certificates, open registration, create administrators, alter SSH or the firewall.
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run as root on the new VPS.' >&2; exit 1; }
APP_HOST=${1:-}
python3 - "$APP_HOST" <<'PY'
import re, sys
host=sys.argv[1]
labels=host.split('.')
assert len(host)<254 and len(labels)>1 and not all(x.isdigit() for x in labels), 'Pass the DNS hostname, not an IP.'
assert all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', x) for x in labels), 'Invalid lowercase DNS hostname.'
PY
source /etc/os-release
[[ ${ID:-} == ubuntu && ${VERSION_ID:-} == 24.04 ]] || { echo 'This installer targets Ubuntu 24.04 only.' >&2; exit 1; }
APP_ROOT=/opt/most-support-app-v2
[[ -f "$APP_ROOT/backend/manage.py" && -f "$APP_ROOT/docs/index.html" ]] || { echo "Place the reviewed repository in $APP_ROOT first." >&2; exit 1; }
[[ ! -e /etc/most-support-v2/app.env ]] || { echo 'An installation already exists; use update.sh. Secrets will not be overwritten.' >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y python3 python3-venv python3-pip postgresql postgresql-client nginx certbot curl ca-certificates rsync openssl
systemctl enable --now postgresql
[[ $(runuser -u postgres -- psql -tAc "SELECT count(*) FROM pg_roles WHERE rolname='most_v2'") == 0 ]] || { echo 'Database role most_v2 already exists; inspect it before continuing.' >&2; exit 1; }
[[ $(runuser -u postgres -- psql -tAc "SELECT count(*) FROM pg_database WHERE datname='most_v2'") == 0 ]] || { echo 'Database most_v2 already exists; inspect it before continuing.' >&2; exit 1; }
PG_LISTEN=$(runuser -u postgres -- psql -tAc 'SHOW listen_addresses')
[[ "$PG_LISTEN" == localhost || "$PG_LISTEN" == 127.0.0.1 ]] || { echo 'PostgreSQL must listen only on loopback. Inspect listen_addresses.' >&2; exit 1; }

if ! id mostv2 >/dev/null 2>&1; then useradd --system --home /var/lib/most-support-v2 --shell /usr/sbin/nologin mostv2; fi
install -d -o root -g root -m 0755 /etc/most-support-v2
install -d -o mostv2 -g mostv2 -m 0750 /var/lib/most-support-v2
install -d -o mostv2 -g www-data -m 0750 /var/lib/most-support-v2/static
# Nginx needs to traverse the parent to serve collected public static files.
chmod 0751 /var/lib/most-support-v2
install -d -o root -g root -m 0755 /var/lib/letsencrypt /var/www/most-support-v2/app
install -d -o root -g root -m 0700 /var/backups/most-support-v2

APP_SECRET=$(openssl rand -hex 48)
DB_SECRET=$(openssl rand -hex 32)
cat > /etc/most-support-v2/app.env <<EOF
DJANGO_SECRET_KEY=$APP_SECRET
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=$APP_HOST
DJANGO_CSRF_TRUSTED_ORIGINS=https://$APP_HOST
DJANGO_SECURE_SSL_REDIRECT=true
DJANGO_SECURE_COOKIES=true
DJANGO_TRUST_PROXY=true
DJANGO_HSTS_SECONDS=3600
POSTGRES_DB=most_v2
POSTGRES_USER=most_v2
POSTGRES_PASSWORD=$DB_SECRET
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
STATIC_ROOT=/var/lib/most-support-v2/static
PUBLIC_SITE_URL=https://$APP_HOST/app/
REGISTRATION_MODE=closed
PORTAL_INTAKE_MODE=disabled
PYTHONDONTWRITEBYTECODE=1
EOF
printf '127.0.0.1:5432:most_v2:most_v2:%s\n' "$DB_SECRET" > /etc/most-support-v2/pgpass
chmod 0600 /etc/most-support-v2/app.env /etc/most-support-v2/pgpass
printf '%s\n' "$APP_HOST" > /etc/most-support-v2/host
printf "window.MOST_SERVER_CONFIG={enabled:true,apiBase:'/api/v2'};\n" > /etc/most-support-v2/runtime-config.js
chmod 0644 /etc/most-support-v2/host /etc/most-support-v2/runtime-config.js
# Random secrets contain only hexadecimal characters; nothing is logged or passed in argv.
runuser -u postgres -- psql -v ON_ERROR_STOP=1 >/dev/null <<SQL
CREATE ROLE most_v2 WITH LOGIN PASSWORD '$DB_SECRET';
CREATE DATABASE most_v2 OWNER most_v2;
SQL
unset APP_SECRET DB_SECRET

# Application code and the Python environment must be executable by mostv2.
# The only secret files are outside the checkout, already root-only above.
umask 022
chmod 0755 "$APP_ROOT" "$APP_ROOT/backend"
find "$APP_ROOT/backend" -type d -exec chmod 0755 {} +
find "$APP_ROOT/backend" -type f -exec chmod 0644 {} +
python3 -m venv "$APP_ROOT/.venv"
"$APP_ROOT/.venv/bin/pip" install --disable-pip-version-check -r "$APP_ROOT/backend/requirements.txt"
chown -R root:root "$APP_ROOT/backend" "$APP_ROOT/.venv"
chmod -R a+rX "$APP_ROOT/.venv"
runuser -u mostv2 -- test -r "$APP_ROOT/backend/config/settings.py"
runuser -u mostv2 -- "$APP_ROOT/.venv/bin/python" -c 'import django, gunicorn, psycopg'
python3 "$APP_ROOT/tools/build-static.py"
rsync -a --chmod=D755,F644 "$APP_ROOT/docs/" /var/www/most-support-v2/app/
install -o root -g root -m 0644 "$APP_ROOT/deploy/systemd/most-support-v2.service" /etc/systemd/system/
install -o root -g root -m 0644 "$APP_ROOT/deploy/systemd/most-support-v2-backup.service" /etc/systemd/system/
install -o root -g root -m 0644 "$APP_ROOT/deploy/systemd/most-support-v2-backup.timer" /etc/systemd/system/
systemctl daemon-reload
bash "$APP_ROOT/deploy/manage.sh" migrate --noinput
bash "$APP_ROOT/deploy/manage.sh" collectstatic --noinput
find /var/lib/most-support-v2/static -type d -exec chmod 0755 {} +
find /var/lib/most-support-v2/static -type f -exec chmod 0644 {} +
chgrp -R www-data /var/lib/most-support-v2/static
bash "$APP_ROOT/deploy/manage.sh" check --deploy
systemctl enable --now most-support-v2
curl --retry 8 --retry-connrefused --retry-delay 1 --fail --silent --show-error \
  --header "Host: $APP_HOST" --header 'X-Forwarded-Proto: https' \
  http://127.0.0.1:8001/health/
echo
python3 - "$APP_ROOT/deploy/nginx/bootstrap.conf" "$APP_HOST" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text().replace('__APP_HOST__',sys.argv[2])
Path('/etc/nginx/sites-available/most-support-v2').write_text(text)
PY
chmod 0644 /etc/nginx/sites-available/most-support-v2
ln -sf /etc/nginx/sites-available/most-support-v2 /etc/nginx/sites-enabled/most-support-v2
nginx -t
systemctl enable --now nginx
systemctl reload nginx
bash "$APP_ROOT/deploy/backup.sh"
systemctl enable --now most-support-v2-backup.timer
echo 'Installed. HTTP only serves certificate challenges; the application stays unavailable until TLS is enabled.'
echo "Next: certbot certonly --webroot -w /var/lib/letsencrypt --cert-name $APP_HOST -d $APP_HOST"
echo "Then: bash $APP_ROOT/deploy/enable-https.sh"
