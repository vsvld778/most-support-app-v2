#!/usr/bin/env bash
# Run a Django management command with the service's private environment.
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run this command as root.' >&2; exit 1; }
[[ -f /etc/most-support-v2/app.env ]] || { echo 'Run install.sh first.' >&2; exit 1; }
transport=(--pipe)
if [[ -t 0 && -t 1 ]]; then transport=(--pty); fi
exec systemd-run --quiet --wait --collect "${transport[@]}" \
  --property=User=mostv2 --property=Group=mostv2 \
  --property=WorkingDirectory=/opt/most-support-app-v2/backend \
  --property=EnvironmentFile=/etc/most-support-v2/app.env \
  /opt/most-support-app-v2/.venv/bin/python manage.py "$@"
