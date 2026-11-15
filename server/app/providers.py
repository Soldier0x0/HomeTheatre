"""Optional metadata provider (TMDb).

Policy: disabled unless HOME_THEATER_TMDB_KEY is set in the server environment.
When enabled, only public TMDb API endpoints are called with the household's own key;
local paths/inventory are never sent. Results are cached into the catalog with
provenance recorded, and user overrides still win (the scanner never overwrites them).
"""
from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request

API_BASE = "https://api.themoviedb.org/3"
IMAGE_BASE = "https://image.tmdb.org/t/p/"
POSTER_SIZE = "w780"
BACKDROP_SIZE = "w1280"


def tmdb_key() -> str | None:
    return os.environ.get("HOME_THEATER_TMDB_KEY") or None


def enabled() -> bool:
    return bool(tmdb_key())


def _get(url: str) -> dict:
    """GET with a small retry loop — home internet connections drop connections
    occasionally (observed: 'Connection reset by peer' on .50), and one dropped
    request should not permanently miss a title. Retries: 3 attempts, short backoff."""
    last_exc = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (OSError, ValueError) as exc:
            last_exc = exc
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
    raise last_exc


def search_movie(name: str, year: int | None) -> dict | None:
    """Search TMDb. If a year filter kills the results (filenames often carry the
    release year the provider disagrees with), retry once without the year."""
    for y in (year, None):
        result = _search("movie", name, y, year_key="year")
        if result and result.get("results"):
            return result
        if result is None:
            return None  # network/protocol error — don't mask it with a yearless retry
    return result


def search_series(name: str, year: int | None) -> dict | None:
    for y in (year, None):
        result = _search("tv", name, y, year_key="first_air_date_year")
        if result and result.get("results"):
            return result
        if result is None:
            return None
    return result


def _search(kind: str, name: str, year: int | None, year_key: str) -> dict | None:
    key = tmdb_key()
    if not key:
        return None
    q = urllib.parse.urlencode({"query": name, "api_key": key,
                                **({year_key: year} if year else {})})
    try:
        return _get(f"{API_BASE}/search/{kind}?{q}")
    except (OSError, ValueError):
        return None


def enrich(db, title_id: str) -> dict:
    """Best-effort enrichment of one title. Returns a summary; never raises for network errors."""
    t = db.one("SELECT * FROM titles WHERE id=?", (title_id,))
    if not t:
        return {"ok": False, "reason": "title_not_found"}
    result = search_movie(t["name"], t["year"]) if t["kind"] == "movie" else search_series(t["name"], t["year"])
    if not result:
        return {"ok": False, "reason": "no_result_or_network_error"}
    hits = result.get("results") or []
    if not hits:
        return {"ok": False, "reason": "no_result"}
    hit = hits[0]
    from .db import utcnow as _u
    db.execute("UPDATE titles SET tmdb_id=?, synopsis=?, updated_at=? WHERE id=?",
               (hit.get("id"), hit.get("overview") or t["synopsis"], _u(), title_id))
    if hit.get("poster_path"):
        db.upsert_artwork("title", title_id, "poster",
                          f"{IMAGE_BASE}{POSTER_SIZE}{hit['poster_path']}", provenance="tmdb_remote")
    if hit.get("backdrop_path"):
        db.upsert_artwork("title", title_id, "backdrop",
                          f"{IMAGE_BASE}{BACKDROP_SIZE}{hit['backdrop_path']}", provenance="tmdb_remote")
    db.audit("provider_enrich", target_type="title", target_id=title_id,
             target_display=t["name"],
             details={"provider": "tmdb", "tmdb_id": hit.get("id")})
    return {"ok": True, "tmdb_id": hit.get("id"),
            "note": "Remote artwork URLs are loaded directly by the browser (opt-in provider)."}
