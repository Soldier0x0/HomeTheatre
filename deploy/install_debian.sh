#!/usr/bin/env bash
# Home Theater server — Debian install (run ON the media server, e.g. 192.168.1.50).
#
# What it does:
#   1. Creates a Python venv next to this repo copy
#   2. Installs server requirements (FastAPI, uvicorn, static-ffmpeg)
#   3. Creates the library DB + media directories
#   4. Prints the exact next steps (systemd unit, first run)
#
# Usage:
#   sudo ./deploy/install_debian.sh [MEDIA_ROOT]     # default: /srv/media
#
# The script never stores or asks for any credentials. ffmpeg/ffprobe come from
# the static-ffmpeg package on first server start (network download, one time).
set -euo pipefail

MEDIA_ROOT="${1:-/srv/media}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Home Theater install"
echo "    repo:        ${REPO_DIR}"
echo "    media root:  ${MEDIA_ROOT}"

# 1. Python venv
if ! command -v python3 >/dev/null; then
  echo "ERROR: python3 not found. Install it: sudo apt install python3 python3-venv" >&2
  exit 1
fi
cd "${REPO_DIR}"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
./.venv/bin/pip install --upgrade pip -q
./.venv/bin/pip install -r server/requirements.txt -q

# 2. Media root + library data directory
sudo mkdir -p "${MEDIA_ROOT}"
sudo chown "$(id -u):$(id -g)" "${MEDIA_ROOT}"
mkdir -p "${REPO_DIR}/server/data"

# 3. Verify the server can import and start (quick smoke check)
HOME_THEATER_DB="${REPO_DIR}/server/data/home-theater.db" \
HOME_THEATER_PORT=8787 ./.venv/bin/python - <<'EOF'
from server.app.main import app
print("smoke check OK: app imports, DB opens")
EOF

cat <<NEXT

============================================================
Install complete. Next steps (copy-paste):

  1. Install the systemd service (runs at boot, LAN-reachable):

     sudo cp ${REPO_DIR}/deploy/home-theater.service /etc/systemd/system/
     sudo systemctl daemon-reload
     sudo systemctl enable --now home-theater.service

     (edit the unit first if your media root is not ${MEDIA_ROOT})

  2. Open the UI:        http://$(hostname -I 2>/dev/null | awk '{print $1}'):8787
  3. In Settings → Media sources, add: ${MEDIA_ROOT}
  4. In Settings → Administration, set the admin password
     (needed only for deleting files from disk).

Optional env vars (set in the systemd unit):
  HOME_THEATER_AUTOSCAN_SEC=60   rescan every minute while copying files
  HOME_THEATER_TMDB_KEY=...      opt-in metadata provider (no key = disabled)
============================================================
NEXT
