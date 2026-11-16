#!/usr/bin/env bash
# Local staging backup. Replicate these files off the VPS before treating them as disaster recovery.
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run as root.' >&2; exit 1; }
BACKUP_DIR=/var/backups/most-support-v2
[[ -d "$BACKUP_DIR" && -f /etc/most-support-v2/pgpass ]] || { echo 'Backup configuration is missing.' >&2; exit 1; }
exec 9> "$BACKUP_DIR/.backup.lock"
flock -n 9 || { echo 'Another backup is already running.' >&2; exit 1; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
partial=$(mktemp "$BACKUP_DIR/.most-v2-db-XXXXXX")
trap 'rm -f -- "$partial"' EXIT
PGPASSFILE=/etc/most-support-v2/pgpass pg_dump --host=127.0.0.1 --port=5432 --username=most_v2 --dbname=most_v2 --no-owner --no-acl | gzip -9 > "$partial"
gzip -t "$partial"
target="$BACKUP_DIR/most-v2-db-$stamp.sql.gz"
[[ ! -e "$target" ]] || { echo 'Backup filename already exists; retry after one second.' >&2; exit 1; }
mv -- "$partial" "$target"
trap - EXIT
python3 - "$BACKUP_DIR" <<'PY'
from pathlib import Path
import re, sys, time
cutoff=time.time()-14*86400
for path in Path(sys.argv[1]).iterdir():
    if path.is_file() and not path.is_symlink() and re.fullmatch(r'most-v2-db-\d{8}T\d{6}Z\.sql\.gz',path.name) and path.stat().st_mtime < cutoff:
        path.unlink()
PY
echo "Created $target (local staging copy)."
