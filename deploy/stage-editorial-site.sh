#!/usr/bin/env bash
# Build the owner's site preview from the same reviewed source as the public site.
set -euo pipefail
[[ $(id -u) == 0 && $# == 1 ]] || { echo 'Use: stage-editorial-site.sh /path/to/reviewed/site' >&2; exit 1; }
site_source=$(realpath "$1")
target=/var/lib/most-support-v2/static/editorial-site
[[ -f "$site_source/index.html" && -f "$site_source/assets/editorial.js" ]] || exit 1
install -d -m 0755 "$target"
python3 - "$site_source" "$target" <<'PYTHON'
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys

source, target = map(Path, sys.argv[1:])
spec = spec_from_file_location("prepare_editorial_site", source / "portal/deploy/prepare-public.py")
publisher = module_from_spec(spec)
spec.loader.exec_module(publisher)
publisher.SOURCE = source
publisher.DEST = target
sys.argv = ["prepare-public.py", "--platform"]
publisher.main()
PYTHON
