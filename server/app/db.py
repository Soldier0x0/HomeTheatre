"""SQLite persistence for Home Theater.

WAL mode, foreign keys ON, schema versioned via PRAGMA user_version.
All timestamps are UTC ISO-8601 strings.
"""
import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = 1

_SCHEMA = """
CREATE TABLE IF NOT EXISTS media_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'local',          -- local | remote (remote not scanned in this slice)
  root_path TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'never_scanned',-- never_scanned | ok | error | offline
  status_detail TEXT,
  last_scan_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS titles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER,
  kind TEXT NOT NULL,                          -- movie | series
  classification TEXT NOT NULL DEFAULT 'none', -- none | anime  (kind drives Movies/Series shelves)
  genres TEXT NOT NULL DEFAULT '[]',           -- JSON array
  rating TEXT,
  synopsis TEXT,
  imdb_rating REAL,
  tmdb_id INTEGER,
  art_title INTEGER NOT NULL DEFAULT 0,        -- poster artwork already contains the title
  user_overrides TEXT NOT NULL DEFAULT '{}',   -- JSON of manual corrections (never overwritten by refresh)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  year INTEGER,
  UNIQUE (title_id, number)
);

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  name TEXT,
  synopsis TEXT,
  runtime_min INTEGER,
  UNIQUE (season_id, number)
);

CREATE TABLE IF NOT EXISTS media_files (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES media_sources(id) ON DELETE CASCADE,
  rel_path TEXT NOT NULL,                      -- path relative to the source root
  size INTEGER,
  mtime REAL,
  media_kind TEXT NOT NULL,                    -- movie | episode
  title_id TEXT REFERENCES titles(id) ON DELETE CASCADE,
  episode_id TEXT REFERENCES episodes(id) ON DELETE SET NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE (source_id, rel_path)
);

CREATE TABLE IF NOT EXISTS artwork (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,                    -- title | season | episode
  owner_id TEXT NOT NULL,
  role TEXT NOT NULL,                          -- poster | backdrop | still
  server_path TEXT NOT NULL,                   -- absolute path inside a source root (server-side only)
  provenance TEXT NOT NULL DEFAULT 'local_sidecar',
  attribution TEXT,
  UNIQUE (owner_type, owner_id, role)
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playback_state (
  profile_id TEXT NOT NULL,
  title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  position_sec REAL NOT NULL DEFAULT 0,
  duration_sec REAL,
  watched INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, title_id)
);

CREATE TABLE IF NOT EXISTS admin_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  secret_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  params TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  actor_profile TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_display TEXT,
  result TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}'
);
"""


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:20]}"


class Database:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.RLock()  # one shared connection is used from FastAPI's thread pool
        with self._lock:
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
            self._conn.executescript(_SCHEMA)
            self._conn.execute(f"PRAGMA user_version={SCHEMA_VERSION}")
            self._conn.commit()

    def execute(self, sql: str, params: tuple | dict = ()) -> sqlite3.Cursor:
        with self._lock:
            cur = self._conn.execute(sql, params)
            self._conn.commit()
            return cur

    def query(self, sql: str, params: tuple | dict = ()) -> list[sqlite3.Row]:
        with self._lock:
            return self._conn.execute(sql, params).fetchall()

    def one(self, sql: str, params: tuple | dict = ()) -> sqlite3.Row | None:
        with self._lock:
            return self._conn.execute(sql, params).fetchone()

    def insert(self, table: str, values: dict) -> None:
        cols = ", ".join(values)
        marks = ", ".join("?" for _ in values)
        self.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", tuple(values.values()))

    def upsert_artwork(self, owner_type: str, owner_id: str, role: str, server_path: str,
                       provenance: str = "local_sidecar") -> None:
        self.execute(
            """INSERT INTO artwork (id, owner_type, owner_id, role, server_path, provenance)
               VALUES (?,?,?,?,?,?)
               ON CONFLICT (owner_type, owner_id, role)
               DO UPDATE SET server_path=excluded.server_path, provenance=excluded.provenance""",
            (new_id("art"), owner_type, owner_id, role, server_path, provenance),
        )

    def audit(self, action: str, *, actor_profile: str | None = None, target_type: str | None = None,
              target_id: str | None = None, target_display: str | None = None,
              result: str = "ok", details: dict | None = None) -> None:
        # Secrets must never be passed in `details`; callers submit passwords out-of-band.
        self.insert("audit_log", {
            "ts": utcnow(), "actor_profile": actor_profile, "action": action,
            "target_type": target_type, "target_id": target_id, "target_display": target_display,
            "result": result, "details": json.dumps(details or {}),
        })
