"""Home Theater server entrypoint.

Serves the existing prototype UI at "/" and the API under "/api".

Env:
- HOME_THEATER_DB: SQLite path (default: server/data/home-theater.db)
- HOME_THEATER_STATIC_DIR: prototype directory override
- HOME_THEATER_HOST / HOME_THEATER_PORT: uvicorn bind (default 127.0.0.1:8787)
- HOME_THEATER_AUTOSCAN_SEC: periodic rescan interval in seconds (0/unset = off;
  e.g. 60 rescan every minute so newly copied files appear without manual scans)
- HOME_THEATER_TMDB_KEY: optional metadata provider key (provider stays disabled
  unless this is set in the server environment)
"""
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .api import router
from .db import Database
from .security import RateLimiter

REPO_ROOT = Path(__file__).resolve().parents[2]

app = FastAPI(title="Home Theater", version="0.1.0-slice",
              docs_url="/api/docs", openapi_url="/api/openapi.json")
app.include_router(router)

app.state.db = Database(os.environ.get("HOME_THEATER_DB",
                                       str(REPO_ROOT / "server" / "data" / "home-theater.db")))
app.state.limiters = {"admin": RateLimiter(max_events=5, window_sec=60.0)}

# Periodic rescans (optional): picks up files copied into sources without manual scans.
_autoscan_sec = float(os.environ.get("HOME_THEATER_AUTOSCAN_SEC", "0") or 0)
if _autoscan_sec > 0:
    from .autoscan import AutoScanner
    app.state.autoscan = AutoScanner(app.state.db, _autoscan_sec)
    app.state.autoscan.start()

static_dir = Path(os.environ.get("HOME_THEATER_STATIC_DIR",
                                 str(REPO_ROOT / "design" / "prototype")))
app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")


def main() -> None:
    import uvicorn
    uvicorn.run("server.app.main:app",
                host=os.environ.get("HOME_THEATER_HOST", "127.0.0.1"),
                port=int(os.environ.get("HOME_THEATER_PORT", "8787")))


if __name__ == "__main__":
    main()
