"""Media root scanner.

Walks only configured source roots, parses filenames into titles/episodes, reads local
sidecar metadata (NFO) and conventional local artwork names. Incremental: a file whose
size+mtime is unchanged is skipped. Keeps all filesystem access inside the configured root.
"""
import json
import re
import time
import xml.etree.ElementTree as ET
from pathlib import Path

from .db import Database, new_id, utcnow

VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".mpg", ".mpeg", ".ts"}
ART_BY_ROLE = {
    "poster": ("poster.jpg", "poster.png", "folder.jpg", "folder.png"),
    "backdrop": ("fanart.jpg", "backdrop.jpg", "fanart.png"),
}

_SxxEyy = re.compile(r"[Ss](\d{1,2})[Ee](\d{1,3})")
_1x01 = re.compile(r"(?<!\d)(\d{1,2})x(\d{1,3})(?!\d)")
_year = re.compile(r"\((\d{4})\)|(?<!\d)(19\d{2}|20\d{2})(?!\d)")
_episode_stem = re.compile(
    r"^(?P<show>.+?)[ _.-]+[Ss]\d{1,2}[Ee]\d{1,3}(?:[ _.-]+(?P<title>.*))?$"
)


def _clean(name: str) -> str:
    return re.sub(r"[_.]+", " ", name).strip(" .-_") or name


def parse_episode(rel_path: str) -> dict | None:
    """Return {show, year, season, episode, name} if the path looks like an episode."""
    parts = Path(rel_path).parts
    stem = Path(rel_path).stem
    m = _SxxEyy.search(stem) or (len(parts) > 1 and _1x01.search(stem))
    show, year = None, None
    if not m:
        # "Season 1" directory + episode number in stem
        season_dir = next((p for p in parts if re.fullmatch(r"(?i)season[ _]?(\d{1,2})", p)), None)
        if not season_dir:
            return None
        num = re.search(r"(\d{1,3})", stem)
        if not num:
            return None
        season = int(re.search(r"(\d+)", season_dir).group(1))
        episode = int(num.group(1))
        name = _clean(re.sub(r"^\d{1,3}[ ._-]+", "", stem)) or None
        dirs = [p for p in parts[:-1] if not re.fullmatch(r"(?i)season[ _]?\d{1,2}", p)]
        if dirs:
            ym = _year.search(dirs[-1])
            if ym:
                year = int(ym.group(1) or ym.group(2))
                show = _clean(dirs[-1][:ym.start()])
            else:
                show = _clean(dirs[-1])
        return {"show": show, "year": year, "season": season, "episode": episode, "name": name}
    season, episode = int(m.group(1)), int(m.group(2))
    em = _episode_stem.match(stem)
    if em and em.group("show"):
        show = _clean(em.group("show"))
        ym = _year.search(show)
        if ym:
            year = int(ym.group(1) or ym.group(2))
            show = _clean(show[:ym.start()])
    if not show:
        # nearest non-"Season X" directory component is the show folder
        candidates = [p for p in parts[:-1] if not re.fullmatch(r"(?i)season[ _]?\d{1,2}", p)]
        if candidates:
            ym = _year.search(candidates[-1])
            if ym:
                year = int(ym.group(1) or ym.group(2))
                show = _clean(candidates[-1][:ym.start()])
            else:
                show = _clean(candidates[-1])
    if year is None and len(parts) > 1:
        # year often sits in the show directory even when the filename matched first
        candidates = [p for p in parts[:-1] if not re.fullmatch(r"(?i)season[ _]?\d{1,2}", p)]
        if candidates:
            ym = _year.search(candidates[-1])
            if ym:
                year = int(ym.group(1) or ym.group(2))
    title = em.group("title") if em else None
    return {"show": show, "year": year, "season": season, "episode": episode,
            "name": _clean(title) if title else None}


def parse_movie(rel_path: str) -> dict:
    stem = Path(rel_path).stem
    year = None
    ym = _year.search(stem)
    if ym:
        year = int(ym.group(1) or ym.group(2))
        stem = stem[:ym.start()].strip(" .-_")
    name = _clean(stem)
    return {"name": name, "year": year}


def read_nfo(video_path: Path) -> dict | None:
    """Read <name>.nfo or movie.nfo / tvshow.nfo next to the file, its directory, or the show directory above a season folder."""
    candidates = [video_path.with_suffix(".nfo"),
                  video_path.parent / "movie.nfo", video_path.parent / "tvshow.nfo"]
    if re.fullmatch(r"(?i)season[ _]?\d{1,2}", video_path.parent.name):
        candidates += [video_path.parent.parent / "tvshow.nfo"]
    for nfo in candidates:
        if nfo.is_file():
            try:
                root = ET.parse(nfo).getroot()
            except ET.ParseError:
                return None
            data = {}
            def text(tag):
                el = root.find(tag)
                return el.text.strip() if el is not None and el.text else None
            data["name"] = text("title") or text("name")
            data["year"] = int(text("year")) if (text("year") or "").isdigit() else None
            data["synopsis"] = text("plot") or text("outline")
            data["rating"] = text("mpaa") or text("certification")
            g = [e.text.strip() for e in root.findall("genre") if e.text]
            data["genres"] = g or None
            # anime classification: explicit tag or anime-family uniqueid
            if root.find("anime") is not None:
                data["classification"] = "anime"
            else:
                for uid in root.findall("uniqueid"):
                    if (uid.get("type") or "").lower() in {"anidb", "anilist", "mal", "kitsu"}:
                        data["classification"] = "anime"
            return data
    return None


def find_local_art(directory: Path) -> dict[str, Path]:
    found = {}
    for role, names in ART_BY_ROLE.items():
        for n in names:
            p = directory / n
            if p.is_file():
                found[role] = p
                break
    return found


def ensure_title(db: Database, *, name: str, year: int | None, kind: str,
                 nfo: dict | None) -> str:
    """Find an existing title by (lowercased name, kind) or create it. Year is informational."""
    row = db.one("SELECT id FROM titles WHERE lower(name)=? AND kind=? ORDER BY id LIMIT 1",
                 (name.lower(), kind))
    if row:
        return row["id"]
    tid = new_id("t")
    genres = (nfo or {}).get("genres")
    db.insert("titles", {
        "id": tid, "name": name, "year": year, "kind": kind,
        "classification": (nfo or {}).get("classification", "none"),
        "genres": json.dumps(genres, ensure_ascii=False) if genres else "[]",
        "rating": (nfo or {}).get("rating"), "synopsis": (nfo or {}).get("synopsis"),
        "created_at": utcnow(), "updated_at": utcnow(),
    })
    return tid


def ensure_series(db: Database, show: str, year: int | None, nfo: dict | None,
                  episode_dir: Path) -> tuple[str, str, int]:
    """Return (title_id, season_id, season_number), creating rows as needed."""
    tid = ensure_title(db, name=show, year=year, kind="series", nfo=nfo)
    season_dir = next((p for p in episode_dir.parts
                       if re.fullmatch(r"(?i)season[ _]?(\d{1,2})", p)), None)
    season_no = (int(re.search(r"(\d+)", season_dir).group(1)) if season_dir else 1)
    srow = db.one("SELECT id FROM seasons WHERE title_id=? AND number=?", (tid, season_no))
    if srow:
        sid = srow["id"]
    else:
        sid = new_id("s")
        db.insert("seasons", {"id": sid, "title_id": tid, "number": season_no, "year": None})
        art = find_local_art(episode_dir.parent)
        if "poster" in art:
            db.upsert_artwork("title", tid, "poster", str(art["poster"]))
    return tid, sid, season_no


def ensure_episode(db: Database, season_id: str, number: int, name: str | None,
                   synopsis: str | None, nfo_episode: dict | None) -> str:
    row = db.one("SELECT id FROM episodes WHERE season_id=? AND number=?", (season_id, number))
    if row:
        return row["id"]
    eid = new_id("e")
    db.insert("episodes", {
        "id": eid, "season_id": season_id, "number": number,
        "name": name or (nfo_episode or {}).get("name"),
        "synopsis": synopsis or (nfo_episode or {}).get("synopsis"),
        "runtime_min": None,
    })
    return eid


def scan_source(db: Database, source_id: str) -> dict:
    """Scan one configured source. Returns a result summary; never raises for per-file errors."""
    src = db.one("SELECT * FROM media_sources WHERE id=?", (source_id,))
    if not src:
        return {"error": "source_not_found"}
    root = Path(src["root_path"])
    stats = {"scanned": 0, "indexed": 0, "skipped": 0, "errors": 0, "titles": 0}
    if not root.is_dir():
        db.execute("UPDATE media_sources SET status='offline', last_scan_at=? WHERE id=?",
                   (utcnow(), source_id))
        stats["errors"] += 1
        return stats

    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in VIDEO_EXTS:
            continue
        stats["scanned"] += 1
        rel = path.relative_to(root).as_posix()
        st = path.stat()
        existing = db.one("SELECT id, size, mtime FROM media_files WHERE source_id=? AND rel_path=?",
                          (source_id, rel))
        if existing and existing["size"] == st.st_size and abs(existing["mtime"] - st.st_mtime) < 1:
            stats["skipped"] += 1
            continue
        try:
            nfo = read_nfo(path)
            ep = parse_episode(rel)
            if ep:
                year = nfo.get("year") if nfo and nfo.get("year") is not None else ep.get("year")
                tid, sid, sno = ensure_series(db, ep["show"] or "Unknown Series", year, nfo,
                                              Path(rel).parent)
                eid = ensure_episode(db, sid, ep["episode"], ep["name"], None, None)
                media_kind = "episode"
                still = next((path.with_suffix("").with_name(f"{path.stem}-thumb{ext}")
                              for ext in (".jpg", ".png")
                              if path.with_suffix("").with_name(f"{path.stem}-thumb{ext}").is_file()), None)
                if still:
                    db.upsert_artwork("episode", eid, "still", str(still))
            else:
                mv = parse_movie(rel)
                tid = ensure_title(db, name=nfo["name"] if nfo and nfo.get("name") else mv["name"],
                                   year=nfo.get("year") if nfo else mv["year"], kind="movie", nfo=nfo)
                eid, sid, sno, media_kind = None, None, None, "movie"
                art = find_local_art(path.parent)
                if "poster" in art:
                    db.upsert_artwork("title", tid, "poster", str(art["poster"]))
                if "backdrop" in art:
                    db.upsert_artwork("title", tid, "backdrop", str(art["backdrop"]))
            if existing:
                db.execute("UPDATE media_files SET size=?, mtime=?, media_kind=?, title_id=?, episode_id=?, deleted=0 WHERE id=?",
                           (st.st_size, st.st_mtime, media_kind, tid, eid, existing["id"]))
            else:
                db.insert("media_files", {
                    "id": new_id("f"), "source_id": source_id, "rel_path": rel,
                    "size": st.st_size, "mtime": st.st_mtime,
                    "media_kind": media_kind, "title_id": tid, "episode_id": eid,
                })
            stats["indexed"] += 1
        except Exception:  # per-file isolation: log-and-continue keeps scans non-blocking
            stats["errors"] += 1

    db.execute("UPDATE media_sources SET status='ok', status_detail=?, last_scan_at=? WHERE id=?",
               (f"{stats['indexed']} indexed, {stats['errors']} errors", utcnow(), source_id))
    stats["titles"] = db.one("SELECT COUNT(*) c FROM titles")["c"]
    return stats
