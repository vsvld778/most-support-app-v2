#!/usr/bin/env bash
# Install the isolated sandbox from a reviewed checkout at the supplied commit.
set -euo pipefail
umask 022
[[ $(id -u) == 0 && $# -eq 1 ]] || { echo 'Usage: deploy staff sandbox with one reviewed commit' >&2; exit 1; }
prod=/opt/most-support-app-v2
checkout=/opt/most-support-staff-sandbox
config=/etc/most-support-staff-sandbox
state=/var/lib/most-support-staff-sandbox
public=/var/www/most-support-staff-sandbox
service=most-support-staff-sandbox
host=$(cat /etc/most-support-v2/host)
revision=$1
test "$(git -C "$prod" rev-parse "$revision^{commit}")" = "$revision"
if [ ! -d "$checkout" ]; then
    git -C "$prod" worktree add --detach "$checkout" "$revision"
else
    test -z "$(git -C "$checkout" status --porcelain)"
    git -C "$checkout" switch --detach "$revision"
fi
id moststafftest >/dev/null 2>&1 || useradd --system --home "$state/data" --shell /usr/sbin/nologin moststafftest
install -d -m 0755 "$state" "$state/static" "$public/staff-test/app" "$config"
install -d -m 0700 -o moststafftest -g moststafftest "$state/data"
chown moststafftest:moststafftest "$state/static"
chmod 0755 "$checkout" "$checkout/backend"
if [ ! -f "$config/app.env" ]; then
    (
        umask 077
        printf 'DJANGO_SECRET_KEY=%s\n' "$(openssl rand -hex 48)"
        printf 'DJANGO_ALLOWED_HOSTS=%s\nDJANGO_CSRF_TRUSTED_ORIGINS=https://%s\n' "$host" "$host"
        printf 'DJANGO_TRUST_PROXY=true\nDJANGO_HSTS_SECONDS=3600\n'
        printf 'DJANGO_SETTINGS_MODULE=config.staff_sandbox\nSTAFF_SANDBOX_DB=%s/data/workspace.sqlite3\nSTATIC_ROOT=%s/static\n' "$state" "$state"
        printf 'PUBLIC_SITE_URL=https://%s/staff-test/cabinet/\nPYTHONDONTWRITEBYTECODE=1\n' "$host"
    ) > "$config/app.env.pending"
    chmod 0600 "$config/app.env.pending"
    mv "$config/app.env.pending" "$config/app.env"
fi
printf "window.MOST_SERVER_CONFIG={enabled:true,apiBase:'/staff-test/api/v2',portalBase:'/staff-test'};\n" > "$config/runtime-config.js"
python3 "$checkout/tools/build-static.py"
rsync -a --chmod=D755,F644 "$checkout/docs/" "$public/staff-test/app/"
manage() {
    systemd-run --quiet --pipe --wait --collect \
        --property=User=moststafftest --property=Group=moststafftest \
        --property=WorkingDirectory="$checkout/backend" --property=EnvironmentFile="$config/app.env" \
        "$prod/.venv/bin/python" manage.py "$@"
}
manage migrate --noinput
manage collectstatic --noinput
if [ ! -s "$config/test-accounts" ]; then
    (umask 077; manage seed_staff_sandbox > "$config/test-accounts.pending")
    test "$(wc -l < "$config/test-accounts.pending")" -eq 4
    mv "$config/test-accounts.pending" "$config/test-accounts"
fi
chmod 0600 "$config/test-accounts"
manage check --deploy
install -m 0644 "$checkout/deploy/systemd/most-support-staff-sandbox.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable "$service"
systemctl restart "$service"
curl --max-time 8 --retry 6 --retry-connrefused --retry-delay 1 --fail --silent --show-error \
    -H "Host: $host" -H 'X-Forwarded-Proto: https' http://127.0.0.1:8002/health/
vhost=/etc/nginx/sites-available/most-support-v2
snippet=/etc/nginx/snippets/most-support-staff-sandbox.conf
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
cp -p "$vhost" "$config/vhost-before-$timestamp"
if [ -e "$snippet" ]; then cp -p "$snippet" "$config/snippet-before-$timestamp"; fi
install -m 0644 "$checkout/deploy/nginx/staff-sandbox.conf" "$snippet"
python3 - "$vhost" "$snippet" <<'PY'
from pathlib import Path
import sys

vhost = Path(sys.argv[1])
text = vhost.read_text()
line = "    include " + sys.argv[2] + ";"
if line not in text:
    anchor = "    location ^~ /admin/editorial/ {"
    if text.count(anchor) != 1:
        raise SystemExit("Cannot locate the TLS vhost include anchor.")
    vhost.write_text(text.replace(anchor, line + "\n" + anchor, 1))
PY
if ! nginx -t || ! systemctl reload nginx; then
    cp -p "$config/vhost-before-$timestamp" "$vhost"
    if [ -e "$config/snippet-before-$timestamp" ]; then
        cp -p "$config/snippet-before-$timestamp" "$snippet"
    fi
    nginx -t && systemctl reload nginx
    exit 1
fi
curl --fail --silent --show-error "https://$host/staff-test/health/"
printf '\nSandbox ready at https://%s/staff-test/\n' "$host"
