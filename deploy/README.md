# Running the Home Theater server on the Debian media box

This kit deploys the server to the machine that holds the media (e.g.
`192.168.1.50`), so it indexes files directly from local disk — no network
shares, no mounting, no extra moving parts.

## 1. Get the repo onto the media server

From this machine:

```bash
git clone <your-remote-url>        # or: rsync -a ~/HomeTheatre/ user@192.168.1.50:/opt/HomeTheatre/
ssh user@192.168.1.50
```

## 2. Install (one command)

```bash
cd /opt/HomeTheatre                # wherever the repo was placed
sudo ./deploy/install_debian.sh /srv/media
```

The script creates a venv, installs requirements, prepares `/srv/media`, and
smoke-checks that the app starts. It never asks for or stores credentials.

## 3. Enable the service

```bash
sudo cp deploy/home-theater.service /etc/systemd/system/
# edit User=, WorkingDirectory=, and ReadWritePaths= to match your paths
sudo systemctl daemon-reload
sudo systemctl enable --now home-theater
```

## 4. First run in the browser

- Open `http://192.168.1.50:8787`
- **Settings → Media sources**: add `/srv/media` (or wherever the movies and
  series are being copied). The first scan indexes everything; with
  `HOME_THEATER_AUTOSCAN_SEC=60` (set in the unit) files that arrive later are
  picked up automatically within about a minute.
- **Settings → Administration**: set the admin password. This is needed only
  for deleting files from disk; nothing else in the UI asks for it.

## Honest limits (read before exposing beyond your LAN)

- The web UI has **no login**; the only server-side gate is the admin password
  for file deletion. Keep the port on the LAN (don't port-forward it yet).
- Transcoding of incompatible files uses CPU (libx264). One or two concurrent
  streams are fine on a typical household box.
- ffmpeg/ffprobe are fetched once by `static-ffmpeg` on first start (needs
  network the first time).
- Scans are in-process threads; a very large library takes a while on first
  index, then incremental scans skip unchanged files.

## Alternatives considered

- *SMB/NFS mount on this machine instead*: requires share services on the
  media box (`samba`/`nfs-kernel-server`) plus mounts here. Running the server
  on the media box is simpler and faster (direct disk reads, no double copies).
- *Streaming from this laptop*: fine for testing; the deployment above is the
  durable setup.
