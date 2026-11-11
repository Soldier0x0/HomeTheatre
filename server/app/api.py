"""Home Theater HTTP API + catalog shaping.

Boundaries enforced here (server-side only):
- File deletion requires an administrator password, verified against the scrypt
  verifier in the database, rate limited, and audited without the secret.
- All filesystem reads/writes stay inside configured media-source roots.
- Removing a catalog entry or a media source never deletes files.
"""
from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import re
import urllib.parse
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from .db import Database, new_id, utcnow
from .scanner import scan_source
from .security import RateLimiter, audit_details_safe, hash_secret, verify_secret

router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class SourceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    root_path: str = Field(min_length=1, max_length=1024)
    kind: str = "local"  # local | remote (remote roots are indexed only if mounted locally)


class TitleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    year: int | None = Field(default=None, ge=1900, le=2100)
    genres: list[str] | None = None
    synopsis: str | None = Field(default=None, max_length=4000)
    rating: str | None = Field(default=None, max_length=20)


class AdminPassword(BaseModel):
    password: str = Field(min_length=1, max_length=1024)


class FileDeleteRequest(BaseModel):
    admin_password: str = Field(min_length=1, max_length=1024)
    confirm_path: str = Field(min_length=1, max_length=1024)  # must equal the file's rel_path


class ProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=28)
    color: str | None = Field(default=None, max_length=20)


class PlaybackUpdate(BaseModel):
    position_sec: float = Field(ge=0)
    duration_sec: float | None = Field(default=None, ge=0)
    watched: bool | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VIDEO_TYPES = {".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm",
               ".mkv": "video/x-matroska", ".mov": "video/quicktime", ".ts": "video/mp2t"}


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _containment_error(path: Path, root: Path) -> bool:
    """True if resolved path escapes the resolved root."""
    try:
        return os.path.commonpath([str(path), str(root)]) != str(root)
    except ValueError:  # different drives / disjoint anchors
        return True


def _resolve_media_file(db: Database, file_id: str):
    """Resolve a media_files row to (abs_path, source_root, row). Raises 404."""
    row = db.one(
        """SELECT mf.rel_path, mf.deleted, ms.root_path
           FROM media_files mf JOIN media_sources ms ON ms.id = mf.source_id
           WHERE mf.id = ?""", (file_id,))
    if not row or row["deleted"]:
        raise HTTPException(status_code=404, detail="File not found in the catalog.")
    root = Path(row["root_path"]).resolve()
    path = (root / row["rel_path"]).resolve()
    if _containment_error(path, root):
        raise HTTPException(status_code=404, detail="File path escapes its configured source root.")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File is missing from storage.")
    return path, root, row


def _serve_local_file(path: Path, root: Path, range_header: str | None):
    size = path.stat().st_size
    start, end = 0, size - 1
    status = 200
    headers = {"Accept-Ranges": "bytes", "Content-Length": str(size)}
    if range_header:
        m = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not m or (not m.group(1) and not m.group(2)):
            raise HTTPException(status_code=416, detail="Unsupported Range header.")
        if m.group(1):
            start = int(m.group(1))
            end = int(m.group(2)) if m.group(2) else size - 1
        else:  # bytes=-N : final N bytes
            n = int(m.group(2))
            start, end = max(0, size - n), size - 1
        if start >= size or end < start:
            headers = {"Content-Range": f"bytes */{size}"}
            raise HTTPException(status_code=416, detail="Requested range not satisfiable.",
                                headers=headers)
        end = min(end, size - 1)
        status = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        headers["Content-Length"] = str(end - start + 1)
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"

    def chunks():
        with path.open("rb") as fh:
            fh.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                block = fh.read(min(1 << 20, remaining))
                if not block:
                    break
                remaining -= len(block)
                yield block

    from fastapi.responses import StreamingResponse
    return StreamingResponse(chunks(), status_code=status, media_type=media_type,
                             headers=headers)


# ---------------------------------------------------------------------------
# Catalog shaping (matches the client's mock-data contract exactly)
# ---------------------------------------------------------------------------

def _placeholder(seed: str, wide: bool) -> str:
    """Deterministic gradient placeholder so cards/hero always render artwork."""
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    h1, h2 = digest[0] * 360 // 255, digest[1] * 360 // 255
    w, h = (1600, 900) if wide else (640, 960)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
           f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
           f'<stop offset="0" stop-color="hsl({h1},38%,26%)"/>'
           f'<stop offset="1" stop-color="hsl({h2},55%,9%)"/></linearGradient></defs>'
           f'<rect width="{w}" height="{h}" fill="url(#g)"/>'
           f'<rect width="{w}" height="{h}" fill="none" stroke="hsl(0,0%,100%,0.08)" stroke-width="4"/></svg>')
    return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)


def _runtime_minutes_str(minutes: int | None) -> str | None:
    if not minutes or minutes <= 0:
        return None
    return f"{minutes // 60}h {minutes % 60}m" if minutes >= 60 else f"{minutes}m"


def _art_url(db: Database, owner_type: str, owner_id: str, role: str, seed: str) -> str:
    row = db.one("SELECT id, server_path FROM artwork WHERE owner_type=? AND owner_id=? AND role=?",
                 (owner_type, owner_id, role))
    if row and Path(row["server_path"]).is_file():
        return f"/api/art/{row['id']}"
    return _placeholder(seed, wide=(role == "backdrop"))


def _shaped_movie(db: Database, t, playback: dict | None) -> dict:
    genres = json.loads(t["genres"] or "[]")
    file_row = db.one(
        """SELECT mf.id, mf.rel_path FROM media_files mf
           WHERE mf.title_id=? AND mf.media_kind='movie' AND mf.deleted=0
           ORDER BY mf.rel_path LIMIT 1""", (t["id"],))
    item = {
        "id": t["id"], "title": t["name"], "type": "Movie", "year": t["year"],
        "genres": genres, "runtime": _runtime_minutes_str(None),
        "rating": t["rating"], "imdbRating": t["imdb_rating"], "tmdbId": t["tmdb_id"],
        "desc": t["synopsis"] or "",
        "art": _art_url(db, "title", t["id"], "poster", t["id"]),
        "poster": _art_url(db, "title", t["id"], "poster", t["id"]),
        "backdrop": _art_url(db, "title", t["id"], "backdrop", t["id"]),
        "artTitle": False,
        "progress": 0.0, "progressLabel": "Not started",
    }
    if file_row:
        item["stream"] = f"/api/stream/{file_row['id']}"
        item["fileName"] = file_row["rel_path"]
    if playback and playback.get("duration_sec") and playback["duration_sec"] > 0:
        frac = min(1.0, (playback.get("position_sec") or 0) / playback["duration_sec"])
        item["progress"] = round(frac, 4)
        if playback.get("watched"):
            item["progressLabel"] = "Watched"
        elif frac > 0:
            left = max(0, int(playback["duration_sec"] - (playback.get("position_sec") or 0)))
            item["progressLabel"] = f"{max(1, round(left / 60))}m left" if left >= 60 else "Less than a minute left"
    return item


def _shaped_series(db: Database, t, playback: dict | None) -> dict:
    genres = json.loads(t["genres"] or "[]")
    is_anime = t["classification"] == "anime"
    season_rows = db.query("SELECT * FROM seasons WHERE title_id=? ORDER BY number", (t["id"],))
    season_count = len(season_rows)
    episode_count = 0
    seasons = []
    for s in season_rows:
        ep_rows = db.query("SELECT * FROM episodes WHERE season_id=? ORDER BY number", (s["id"],))
        episode_count += len(ep_rows)
        episodes = []
        for e in ep_rows:
            frow = db.one("""SELECT mf.id FROM media_files mf
                             WHERE mf.episode_id=? AND mf.deleted=0
                             ORDER BY mf.rel_path LIMIT 1""", (e["id"],))
            ep = {
                "number": e["number"], "title": e["name"] or f"Episode {e['number']}",
                "runtime": _runtime_minutes_str(e["runtime_min"]) or "",
                "desc": e["synopsis"] or "",
                "art": _art_url(db, "episode", e["id"], "still", e["id"]),
            }
            if frow:
                ep["stream"] = f"/api/stream/{frow['id']}"
            episodes.append(ep)
        seasons.append({"number": s["number"], "year": s["year"],
                        "episodeCount": len(episodes), "episodes": episodes})
    poster = _art_url(db, "title", t["id"], "poster", t["id"])
    item = {
        "id": t["id"], "title": t["name"],
        "type": "Anime series" if is_anime else "Series",
        "isAnime": is_anime, "year": t["year"], "genres": genres,
        "runtime": f"{season_count} season{'s' if season_count != 1 else ''} | {episode_count} episodes",
        "rating": t["rating"], "imdbRating": t["imdb_rating"], "tmdbId": t["tmdb_id"],
        "desc": t["synopsis"] or "",
        "art": poster, "poster": poster,
        "backdrop": _art_url(db, "title", t["id"], "backdrop", t["id"]),
        "artTitle": bool(db.one("SELECT 1 FROM artwork WHERE owner_type='title' AND owner_id=? AND role='poster'", (t["id"],))),
        "seasonCount": season_count, "episodeCount": episode_count,
        "seasons": seasons,
        "progress": 0.0, "progressLabel": "Not started",
    }
    if playback:
        item["progress"] = 1.0 if playback.get("watched") else item["progress"]
        item["progressLabel"] = "Watched" if playback.get("watched") else item["progressLabel"]
    return item


def shaped_catalog(db: Database, profile_id: str | None) -> dict:
    playback = {}
    if profile_id:
        for row in db.query("SELECT * FROM playback_state WHERE profile_id=?", (profile_id,)):
            playback[row["title_id"]] = dict(row)
    hero, films, series = [], [], []
    rows = db.query("SELECT * FROM titles ORDER BY name COLLATE NOCASE")
    for t in rows:
        if t["kind"] == "movie":
            item = _shaped_movie(db, t, playback.get(t["id"]))
            films.append(item)
        else:
            item = _shaped_series(db, t, playback.get(t["id"]))
            series.append(item)
    # Hero: three most recent movies/series that have real backdrops (not placeholders).
    def has_backdrop(item):
        return not item["backdrop"].startswith("data:")
    candidates = [x for x in films if has_backdrop(x) and x["backdrop"]] + \
                 [x for x in series if has_backdrop(x) and x["backdrop"]]
    for item in candidates[:3]:
        hero.append({k: item[k] for k in (
            "id", "title", "type", "year", "genres", "runtime", "rating", "desc",
            "tmdbId", "imdbRating", "art", "poster", "backdrop") if k in item})
    return {"hero": hero, "films": films, "series": series,
            "credits": "Artwork and metadata indexed from local media sources."}


def _title_or_404(db: Database, title_id: str):
    t = db.one("SELECT * FROM titles WHERE id=?", (title_id,))
    if not t:
        raise HTTPException(status_code=404, detail="Title not found.")
    return t


def _require_admin(db: Database, request: Request, admin_password: str) -> None:
    """Server-side admin boundary. Rate limited; audits without the secret."""
    limiters = request.app.state.limiters
    key = _client_key(request)
    row = db.one("SELECT secret_hash, salt, params FROM admin_auth WHERE id=1")
    if not row:
        raise HTTPException(status_code=409, detail="No administrator password is configured yet.")
    if not limiters["admin"].allow(key):
        db.audit("admin_verify", actor_profile=None, target_type="admin", result="rate_limited")
        raise HTTPException(status_code=429, detail="Too many attempts. Try again shortly.")
    if not verify_secret(admin_password, row["secret_hash"], row["salt"], row["params"]):
        db.audit("admin_verify", target_type="admin", result="denied",
                 details=audit_details_safe({"attempt": "file-or-admin-action"}))
        raise HTTPException(status_code=403, detail="Administrator authorization failed.")


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/health")
def health():
    return {"ok": True, "service": "home-theater", "version": "0.1.0-slice"}


# ---------------------------------------------------------------------------
# Media sources
# ---------------------------------------------------------------------------

@router.get("/sources")
def list_sources(request: Request):
    rows = request.app.state.db.query("SELECT id, name, kind, root_path, enabled, status, status_detail, last_scan_at FROM media_sources ORDER BY created_at")
    return {"sources": [dict(r) for r in rows]}


@router.post("/sources")
def add_source(body: SourceCreate, request: Request):
    db: Database = request.app.state.db
    root = Path(body.root_path).expanduser()
    status = "ok" if root.is_dir() else "offline"
    sid = new_id("src")
    db.insert("media_sources", {
        "id": sid, "name": body.name, "kind": body.kind if body.kind in {"local", "remote"} else "local",
        "root_path": str(root), "status": status,
        "status_detail": None if root.is_dir() else "Root path not accessible at creation time.",
        "created_at": utcnow(),
    })
    db.audit("source_add", target_type="media_source", target_id=sid,
             target_display=body.name, details={"root_path": str(root), "status": status})
    return {"id": sid, "status": status}


@router.post("/sources/{source_id}/scan")
def scan(source_id: str, request: Request):
    db: Database = request.app.state.db
    if not db.one("SELECT id FROM media_sources WHERE id=?", (source_id,)):
        raise HTTPException(status_code=404, detail="Source not found.")
    result = scan_source(db, source_id)
    db.audit("source_scan", target_type="media_source", target_id=source_id,
             details=audit_details_safe(result))
    return result


@router.delete("/sources/{source_id}")
def remove_source(source_id: str, request: Request):
    """Remove a source and its index records. Never touches media files on disk."""
    db: Database = request.app.state.db
    if not db.one("SELECT id FROM media_sources WHERE id=?", (source_id,)):
        raise HTTPException(status_code=404, detail="Source not found.")
    files = db.one("SELECT COUNT(*) c FROM media_files WHERE source_id=?", (source_id,))["c"]
    db.execute("DELETE FROM media_sources WHERE id=?", (source_id,))
    # clean titles (and their seasons/episodes via cascade) that no longer have any indexed file
    db.execute("DELETE FROM titles WHERE id NOT IN (SELECT DISTINCT title_id FROM media_files WHERE title_id IS NOT NULL)")
    db.audit("source_remove", target_type="media_source", target_id=source_id,
             details={"indexed_files_removed": files, "media_files_on_disk": "untouched"})
    return {"removed": True, "indexed_files_removed": files,
            "note": "Media files on disk were not deleted."}


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------

@router.get("/catalog/shaped")
def catalog_shaped(request: Request, profile: str | None = None):
    return shaped_catalog(request.app.state.db, profile)


@router.get("/catalog/{title_id}")
def catalog_title(title_id: str, request: Request):
    db = request.app.state.db
    t = _title_or_404(db, title_id)
    if t["kind"] == "movie":
        return _shaped_movie(db, t, None)
    return _shaped_series(db, t, None)


@router.patch("/catalog/{title_id}")
def update_title(title_id: str, body: TitleUpdate, request: Request):
    """Manual corrections. Stored as user_overrides and applied to the catalog record."""
    db = request.app.state.db
    t = _title_or_404(db, title_id)
    overrides = json.loads(t["user_overrides"] or "{}")
    updates, override_changes = {}, {}
    if body.name is not None:
        updates["name"], override_changes["name"] = body.name, body.name
    if body.year is not None:
        updates["year"], override_changes["year"] = body.year, body.year
    if body.genres is not None:
        updates["genres"] = json.dumps(body.genres, ensure_ascii=False)
        override_changes["genres"] = body.genres
    if body.synopsis is not None:
        updates["synopsis"], override_changes["synopsis"] = body.synopsis, body.synopsis
    if body.rating is not None:
        updates["rating"], override_changes["rating"] = body.rating, body.rating
    if updates:
        updates["updated_at"] = utcnow()
        updates["user_overrides"] = json.dumps({**overrides, **override_changes}, ensure_ascii=False)
        sets = ", ".join(f"{k}=?" for k in updates)
        db.execute(f"UPDATE titles SET {sets} WHERE id=?", (*updates.values(), title_id))
        db.audit("title_update", target_type="title", target_id=title_id, target_display=t["name"])
    return {"ok": True}


@router.post("/catalog/{title_id}/remove")
def remove_from_library(title_id: str, request: Request):
    """Remove a title from the catalog. Files on disk are NEVER deleted here."""
    db = request.app.state.db
    t = _title_or_404(db, title_id)
    files = db.one("SELECT COUNT(*) c FROM media_files WHERE title_id=?", (title_id,))["c"]
    db.execute("DELETE FROM titles WHERE id=?", (title_id,))
    db.audit("library_remove", target_type="title", target_id=title_id, target_display=t["name"],
             details={"indexed_files_dropped": files, "media_files_on_disk": "untouched"})
    return {"removed": True, "indexed_files_dropped": files,
            "note": "Catalog entry removed. Media files on disk were not deleted."}


# ---------------------------------------------------------------------------
# Profiles (passwordless household profiles)
# ---------------------------------------------------------------------------

@router.get("/profiles")
def list_profiles(request: Request):
    rows = request.app.state.db.query("SELECT id, name, color, created_at FROM profiles ORDER BY created_at")
    return {"profiles": [dict(r) for r in rows]}


@router.post("/profiles")
def create_profile(body: ProfileCreate, request: Request):
    db = request.app.state.db
    existing = db.one("SELECT id FROM profiles WHERE lower(name)=?", (body.name.lower(),))
    if existing:
        return {"id": existing["id"], "existed": True}
    pid = new_id("p")
    db.insert("profiles", {"id": pid, "name": body.name, "color": body.color, "created_at": utcnow()})
    return {"id": pid, "existed": False}


@router.patch("/profiles/{profile_id}")
def rename_profile(profile_id: str, body: ProfileCreate, request: Request):
    db = request.app.state.db
    if not db.one("SELECT id FROM profiles WHERE id=?", (profile_id,)):
        raise HTTPException(status_code=404, detail="Profile not found.")
    db.execute("UPDATE profiles SET name=? WHERE id=?", (body.name, profile_id))
    return {"ok": True}


@router.delete("/profiles/{profile_id}")
def delete_profile(profile_id: str, request: Request):
    db = request.app.state.db
    if not db.one("SELECT id FROM profiles WHERE id=?", (profile_id,)):
        raise HTTPException(status_code=404, detail="Profile not found.")
    db.execute("DELETE FROM profiles WHERE id=?", (profile_id,))
    db.execute("DELETE FROM playback_state WHERE profile_id=?", (profile_id,))
    return {"ok": True}


# ---------------------------------------------------------------------------
# Playback state
# ---------------------------------------------------------------------------

@router.get("/playback/{profile_id}")
def get_playback(profile_id: str, request: Request):
    db = request.app.state.db
    rows = db.query("""SELECT ps.title_id, ps.position_sec, ps.duration_sec, ps.watched, ps.updated_at,
                              ti.name AS title_name, ti.kind
                       FROM playback_state ps JOIN titles ti ON ti.id = ps.title_id
                       WHERE ps.profile_id=? ORDER BY ps.updated_at DESC""", (profile_id,))
    return {"items": [dict(r) for r in rows]}


@router.put("/playback/{profile_id}/{title_id}")
def put_playback(profile_id: str, title_id: str, body: PlaybackUpdate, request: Request):
    db = request.app.state.db
    if not db.one("SELECT id FROM titles WHERE id=?", (title_id,)):
        raise HTTPException(status_code=404, detail="Title not found.")
    watched = body.watched
    if watched is None and body.duration_sec:
        watched = body.position_sec / body.duration_sec > 0.95
    db.execute(
        """INSERT INTO playback_state (profile_id, title_id, position_sec, duration_sec, watched, updated_at)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT (profile_id, title_id)
           DO UPDATE SET position_sec=excluded.position_sec, duration_sec=excluded.duration_sec,
                         watched=excluded.watched, updated_at=excluded.updated_at""",
        (profile_id, title_id, body.position_sec, body.duration_sec, int(bool(watched)), utcnow()))
    return {"ok": True, "watched": bool(watched)}


# ---------------------------------------------------------------------------
# Streaming + artwork
# ---------------------------------------------------------------------------

@router.get("/stream/{file_id}")
def stream(file_id: str, request: Request, range_header: str | None = Header(default=None, alias="Range")):
    path, root, _row = _resolve_media_file(request.app.state.db, file_id)
    return _serve_local_file(path, root, range_header)


@router.get("/art/{artwork_id}")
def art(artwork_id: str, request: Request, range_header: str | None = Header(default=None, alias="Range")):
    db = request.app.state.db
    row = db.one("SELECT server_path FROM artwork WHERE id=?", (artwork_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Artwork not found.")
    path = Path(row["server_path"]).resolve()
    roots = [Path(r["root_path"]).resolve() for r in db.query("SELECT root_path FROM media_sources")]
    if not any(not _containment_error(path, root) for root in roots) or not path.is_file():
        raise HTTPException(status_code=404, detail="Artwork file is missing from its source root.")
    return _serve_local_file(path, path.parent, range_header)


# ---------------------------------------------------------------------------
# Admin boundary
# ---------------------------------------------------------------------------

@router.post("/admin/setup")
def admin_setup(body: AdminPassword, request: Request):
    db = request.app.state.db
    if db.one("SELECT id FROM admin_auth WHERE id=1"):
        raise HTTPException(status_code=409, detail="Administrator password already configured.")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Administrator password must be at least 8 characters.")
    secret_hash, salt, params = hash_secret(body.password)
    db.execute("INSERT INTO admin_auth (id, secret_hash, salt, params, updated_at) VALUES (1,?,?,?,?)",
               (secret_hash, salt, params, utcnow()))
    db.audit("admin_setup", target_type="admin", result="ok")
    return {"ok": True}


@router.post("/admin/verify")
def admin_verify(body: AdminPassword, request: Request):
    _require_admin(request.app.state.db, request, body.password)
    return {"ok": True}


@router.post("/files/{file_id}/delete")
def delete_file(file_id: str, body: FileDeleteRequest, request: Request):
    """Delete an actual media file. Requires server-side admin authorization and an
    exact-path confirmation. The submitted password is never stored or logged."""
    db = request.app.state.db
    row = db.one("""SELECT mf.id, mf.rel_path, mf.deleted, ms.root_path
                    FROM media_files mf JOIN media_sources ms ON ms.id = mf.source_id
                    WHERE mf.id=?""", (file_id,))
    if not row or row["deleted"]:
        raise HTTPException(status_code=404, detail="File not found in the catalog.")
    if body.confirm_path != row["rel_path"]:
        db.audit("file_delete", target_type="media_file", target_id=file_id,
                 target_display=row["rel_path"], result="denied",
                 details={"reason": "confirmation_path_mismatch"})
        raise HTTPException(status_code=400, detail="Confirmation path does not match the indexed file.")
    _require_admin(db, request, body.admin_password)
    root = Path(row["root_path"]).resolve()
    path = (root / row["rel_path"]).resolve()
    if _containment_error(path, root):
        db.audit("file_delete", target_type="media_file", target_id=file_id,
                 target_display=row["rel_path"], result="denied",
                 details={"reason": "path_escapes_source_root"})
        raise HTTPException(status_code=400, detail="File path escapes its configured source root.")
    if not path.is_file():
        db.execute("UPDATE media_files SET deleted=1 WHERE id=?", (file_id,))
        raise HTTPException(status_code=404, detail="File is already missing from storage.")
    path.unlink()
    db.execute("UPDATE media_files SET deleted=1 WHERE id=?", (file_id,))
    db.audit("file_delete", target_type="media_file", target_id=file_id,
             target_display=row["rel_path"], result="ok",
             details={"bytes_freed": None, "media_root": str(root)})
    return {"deleted": True, "file": row["rel_path"]}
