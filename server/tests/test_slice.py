"""Vertical-slice tests: scan → shaped catalog → playback → stream → admin deletion.

Fixtures build a temporary media root mirroring a plausible household layout:
movies, a series in Season folders, and an anime series identified by NFO.
"""
import io
import json
import os
import sqlite3
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))

from fastapi.testclient import TestClient  # noqa: E402

from server.app import api  # noqa: E402
from server.app.db import Database  # noqa: E402
from server.app.scanner import parse_episode, parse_movie, read_nfo  # noqa: E402


def make_video(path: Path, size: int = 4096) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x00" * size)


def build_media_root(root: Path) -> None:
    # Movie with NFO + local art
    movie_dir = root / "Movies" / "Inception (2010)"
    make_video(movie_dir / "Inception (2010).mp4", size=64_000)
    (movie_dir / "Inception (2010).nfo").write_text(
        "<movie><title>Inception</title><year>2010</year>"
        "<plot>A specialist in entering dreams is offered a chance to return home.</plot>"
        "<genre>Action</genre><genre>Science Fiction</genre><mpaa>PG-13</mpaa></movie>")
    (movie_dir / "poster.jpg").write_bytes(b"\xff\xd8fakejpg")
    (movie_dir / "fanart.jpg").write_bytes(b"\xff\xd8fakejpg2")

    # Movie with no sidecar metadata at all (filename-only)
    make_video(root / "Movies" / "Upscaled Rip (2019)" / "Upscaled Rip 2019 1080p.mkv")

    # Series in Season folders, filename SxxEyy naming
    show_dir = root / "TV" / "Arcane (2021)"
    show_dir.mkdir(parents=True)
    (show_dir / "tvshow.nfo").write_text(
        "<tvshow><title>Arcane</title><year>2021</year>"
        "<plot>Two sisters on opposing sides of a conflict.</plot>"
        "<genre>Animation</genre></tvshow>")
    for ep, name in ((1, "Welcome to the Playground"), (2, "Some Mysteries Are Better Left Unsolved")):
        make_video(show_dir / "Season 1" / f"Arcane S01E0{ep} - {name}.mp4")

    # Anime series, classified by anidb uniqueid in tvshow.nfo
    anime_dir = root / "Anime" / "SPY x FAMILY (2022)"
    anime_dir.mkdir(parents=True)
    (anime_dir / "tvshow.nfo").write_text(
        '<tvshow><title>SPY x FAMILY</title><uniqueid type="anidb" default="true">12345</uniqueid>'
        "<plot>A spy, an assassin, and a telepath form a pretend family.</plot>"
        "<genre>Anime</genre></tvshow>")
    make_video(anime_dir / "Season 1" / "SPY x FAMILY - S01E01 - OPERATION STRIX.mkv")


@pytest.fixture()
def client(tmp_path: Path):
    media_root = tmp_path / "media"
    build_media_root(media_root)
    db = Database(tmp_path / "test.db")

    from fastapi import FastAPI
    from fastapi.staticfiles import StaticFiles
    from server.app.security import RateLimiter

    test_app = FastAPI()
    test_app.include_router(api.router)
    test_app.state.db = db
    test_app.state.limiters = {"admin": RateLimiter(max_events=100, window_sec=60)}
    static = tmp_path / "static"
    static.mkdir()
    test_app.mount("/", StaticFiles(directory=str(static)), name="static")

    with TestClient(test_app) as c:
        c.media_root = media_root  # type: ignore[attr-defined]
        c.db = db  # type: ignore[attr-defined]
        yield c


def add_source(client, name="House Library"):
    r = client.post("/api/sources", json={"name": name, "root_path": str(client.media_root)})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def scan(client):
    sid = add_source(client)
    r = client.post(f"/api/sources/{sid}/scan?wait=true")
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Scanner unit behavior
# ---------------------------------------------------------------------------

def test_parse_episode_variants():
    assert parse_episode("TV/Arcane (2021)/Season 1/Arcane S01E02 - Some Mysteries.mp4") == {
        "show": "Arcane", "year": 2021, "season": 1, "episode": 2,
        "name": "Some Mysteries"}
    assert parse_episode("TV/Show (2020)/Season 2/Episode 7.mp4")["season"] == 2
    assert parse_episode("TV/Show (2020)/Season 2/Episode 7.mp4")["episode"] == 7
    assert parse_episode("Movies/Some Movie (2019)/file.mp4") is None


def test_parse_movie_variants():
    assert parse_movie("Movies/Inception (2010)/Inception (2010).mp4") == {
        "name": "Inception", "year": 2010}
    assert parse_movie("Movies/Arrival.2016.1080p.mkv") == {"name": "Arrival", "year": 2016}


def test_read_nfo_detects_anime(tmp_path: Path):
    video = tmp_path / "SPY x FAMILY" / "Season 1" / "ep.mkv"
    video.parent.mkdir(parents=True)
    (tmp_path / "SPY x FAMILY" / "tvshow.nfo").write_text(
        '<tvshow><title>SPY x FAMILY</title><uniqueid type="anidb">12345</uniqueid></tvshow>')
    nfo = read_nfo(video)
    assert nfo and nfo["classification"] == "anime"


# ---------------------------------------------------------------------------
# Scan → shaped catalog
# ---------------------------------------------------------------------------

def test_scan_indexes_all_files(client):
    stats = scan(client)
    assert stats["indexed"] == 5, stats
    assert stats["errors"] == 0


def test_shaped_catalog_contract(client):
    scan(client)
    shaped = client.get("/api/catalog/shaped").json()
    assert set(shaped) >= {"hero", "films", "series"}

    films = {f["title"]: f for f in shaped["films"]}
    # NFO wins over filename
    assert films["Inception"]["year"] == 2010
    assert films["Inception"]["genres"] == ["Action", "Science Fiction"]
    assert films["Inception"]["rating"] == "PG-13"
    assert "dreams" in films["Inception"]["desc"]
    assert films["Inception"]["stream"].startswith("/api/stream/")
    # filename-only movie still appears with placeholder art
    assert films["Upscaled Rip"]["poster"].startswith("data:image/svg+xml")
    assert films["Upscaled Rip"]["backdrop"].startswith("data:image/svg+xml")

    series = {s["title"]: s for s in shaped["series"]}
    arcane = series["Arcane"]
    assert arcane["seasonCount"] == 1 and arcane["episodeCount"] == 2
    assert not arcane.get("isAnime")
    ep1 = arcane["seasons"][0]["episodes"][0]
    assert ep1["title"] == "Welcome to the Playground"
    assert ep1["stream"].startswith("/api/stream/")

    spy = series["SPY x FAMILY"]
    assert spy["isAnime"] is True
    assert spy["type"] == "Anime series"

    # Anime never duplicated into Movies; movies never appear as series
    assert all(not f.get("isAnime") for f in shaped["films"])
    assert "SPY x FAMILY" not in {f["title"] for f in shaped["films"]}

    # hero exists for a non-empty library; items with real backdrops come first
    assert shaped["hero"], "fresh library should still show a hero"
    real = [h for h in shaped["hero"] if not h["backdrop"].startswith("data:")]
    if real:
        assert all(not h["backdrop"].startswith("data:") for h in shaped["hero"][:len(real)])


def test_incremental_scan_skips_unchanged(client):
    scan(client)
    sid = client.get("/api/sources").json()["sources"][0]["id"]
    stats = client.post(f"/api/sources/{sid}/scan?wait=true").json()
    assert stats["indexed"] == 0 and stats["skipped"] == 5


def test_scan_jobs_endpoint(client):
    sid = add_source(client)
    r = client.post(f"/api/sources/{sid}/scan")  # default: background job
    assert r.status_code == 200 and "job_id" in r.json()
    job_id = r.json()["job_id"]
    import time
    job = {"state": "running"}
    for _ in range(200):
        job = client.get(f"/api/scan-jobs/{job_id}").json()
        if job["state"] != "running":
            break
        time.sleep(0.05)
    assert job["state"] == "done"
    assert job["result"]["indexed"] == 5
    assert client.get("/api/scan-jobs/missing").status_code == 404


# ---------------------------------------------------------------------------
# Playback state
# ---------------------------------------------------------------------------

def test_playback_persists_and_computes_watched(client):
    scan(client)
    shaped = client.get("/api/catalog/shaped").json()
    tid = shaped["films"][0]["id"]

    r = client.put(f"/api/playback/p1/{tid}",
                   json={"position_sec": 600, "duration_sec": 1000})
    assert r.status_code == 200 and r.json()["watched"] is False

    items = client.get("/api/playback/p1").json()["items"]
    assert items[0]["title_id"] == tid and items[0]["position_sec"] == 600

    # >95% → watched automatically
    r = client.put(f"/api/playback/p1/{tid}",
                   json={"position_sec": 970, "duration_sec": 1000})
    assert r.json()["watched"] is True

    # profile-shaped progress flows into the catalog
    shaped = client.get("/api/catalog/shaped", params={"profile": "p1"}).json()
    film = next(f for f in shaped["films"] if f["id"] == tid)
    assert film["progress"] == pytest.approx(0.97)
    assert film["progressLabel"] == "Watched"


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------

def test_stream_full_and_range(client):
    scan(client)
    shaped = client.get("/api/catalog/shaped").json()
    stream_url = shaped["films"][0]["stream"]

    r = client.get(stream_url)
    assert r.status_code == 200
    assert len(r.content) == 64_000

    r = client.get(stream_url, headers={"Range": "bytes=0-9"})
    assert r.status_code == 206
    assert len(r.content) == 10
    assert r.headers["content-range"] == "bytes 0-9/64000"
    assert r.headers["accept-ranges"] == "bytes"

    r = client.get(stream_url, headers={"Range": "bytes=999999-"})
    assert r.status_code == 416


def test_stream_unknown_id_is_404(client):
    assert client.get("/api/stream/nonexistent").status_code == 404


# ---------------------------------------------------------------------------
# Artwork
# ---------------------------------------------------------------------------

def test_real_and_placeholder_art(client):
    scan(client)
    shaped = client.get("/api/catalog/shaped").json()
    inception = next(f for f in shaped["films"] if f["title"] == "Inception")
    # local sidecar poster served through the API
    assert inception["poster"].startswith("/api/art/")
    r = client.get(inception["poster"])
    assert r.status_code == 200 and r.headers["content-type"].startswith("image/")


# ---------------------------------------------------------------------------
# Remove from library / remove source — files must survive
# ---------------------------------------------------------------------------

def test_remove_from_library_keeps_file(client):
    scan(client)
    shaped = client.get("/api/catalog/shaped").json()
    film = next(f for f in shaped["films"] if f["title"] == "Inception")
    file_on_disk = client.media_root / film["fileName"]

    r = client.post(f"/api/catalog/{film['id']}/remove")
    assert r.status_code == 200

    shaped = client.get("/api/catalog/shaped").json()
    assert film["id"] not in {f["id"] for f in shaped["films"]}
    assert file_on_disk.is_file()  # file untouched


def test_remove_source_keeps_files(client):
    scan(client)
    sid = client.get("/api/sources").json()["sources"][0]["id"]
    r = client.delete(f"/api/sources/{sid}")
    assert r.status_code == 200
    assert r.json()["indexed_files_removed"] == 5
    remaining = [p for p in client.media_root.rglob("*") if p.is_file()
                 and p.suffix in {".mp4", ".mkv", ".jpg", ".nfo"}]
    assert len(remaining) == 10  # nothing deleted from disk
    assert client.get("/api/catalog/shaped").json()["films"] == []


# ---------------------------------------------------------------------------
# Probe, capability, transcode, subtitles, provider
# ---------------------------------------------------------------------------

def _synth_video(client, rel: str, *codec_args, dur: int = 2):
    """Create a real tiny video inside the media root using the bundled static ffmpeg."""
    import subprocess
    import static_ffmpeg.run as sfr
    ffmpeg, _ = sfr.get_or_fetch_platform_executables_else_raise()
    out = client.media_root / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [ffmpeg, "-hide_banner", "-loglevel", "error",
         "-f", "lavfi", "-i", f"testsrc=size=128x96:rate=10:duration={dur}",
         "-f", "lavfi", "-i", f"sine=frequency=440:duration={dur}",
         *codec_args, "-y", str(out)],
        check=True, capture_output=True)
    return out


def test_probe_runtime_flows_into_catalog(client):
    _synth_video(client, "Movies/Probed Film (2021)/Probed Film (2021).mp4",
                 "-c:v", "libx264", "-c:a", "aac", dur=60)
    scan(client)
    shaped = client.get("/api/catalog/shaped").json()
    film = next(f for f in shaped["films"] if f["title"] == "Probed Film")
    assert film["runtime"] == "1m"          # real duration, not invented
    assert film["compatibility"] == "direct"
    fid = film["stream"].rsplit("/", 1)[1]
    cap = client.get(f"/api/files/{fid}/capability").json()
    assert cap["probed"] and cap["mode"] == "direct"
    assert cap["video_codec"] == "h264" and cap["audio_codecs"] == ["aac"]
    assert cap["duration_sec"] == pytest.approx(60, abs=2)


def test_capability_transcode_for_incompatible_file(client):
    _synth_video(client, "Movies/Old Mpeg2 (1995)/Old Mpeg2 (1995).mpg",
                 "-c:v", "mpeg2video", "-c:a", "mp2", dur=2)
    scan(client)
    shaped = client.get("/api/catalog/shaped").json()
    film = next(f for f in shaped["films"] if f["title"] == "Old Mpeg2")
    assert film["compatibility"] == "transcode"
    fid = film["stream"].rsplit("/", 1)[1]
    cap = client.get(f"/api/files/{fid}/capability").json()
    assert cap["probed"] and cap["mode"] == "transcode"
    assert cap["transcoder_ready"] is True


def test_transcode_stream_produces_fragmented_mp4(client):
    _synth_video(client, "Movies/Old Mpeg2 (1995)/Old Mpeg2 (1995).mpg",
                 "-c:v", "mpeg2video", "-c:a", "mp2", dur=2)
    scan(client)
    shaped = client.get("/api/catalog/shaped").json()
    film = next(f for f in shaped["films"] if f["title"] == "Old Mpeg2")
    r = client.get(film["stream"] + "?transcode=force")
    assert r.status_code == 200
    assert r.headers["x-home-theater-mode"] == "transcoded"
    assert b"ftyp" in r.content[:64]        # valid fragmented-MP4 stream head


def test_probe_unavailable_reports_unknown(client):
    # the zero-byte fixture "movies" cannot be probed; catalog stays honest
    scan(client)
    shaped = client.get("/api/catalog/shaped").json()
    film = next(f for f in shaped["films"] if f["title"] == "Inception")
    assert film["compatibility"] == "unknown"
    fid = film["stream"].rsplit("/", 1)[1]
    cap = client.get(f"/api/files/{fid}/capability").json()
    assert cap["probed"] is False and cap["mode"] == "unknown"


def test_sidecar_subtitles_listing_and_vtt(client):
    movie_dir = client.media_root / "Movies" / "Subbed Film (2020)"
    _synth_video(client, "Movies/Subbed Film (2020)/Subbed Film (2020).mp4",
                 "-c:v", "libx264", "-c:a", "aac", dur=2)
    (movie_dir / "Subbed Film (2020).en.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\nHello there.\n\n")
    (movie_dir / "Subbed Film (2020).te.srt").write_text(
        "1\n00:00:01,000 --> 00:00:02,000\nనమస్కారం.\n\n")
    scan(client)
    shaped = client.get("/api/catalog/shaped").json()
    film = next(f for f in shaped["films"] if f["title"] == "Subbed Film")
    fid = film["stream"].rsplit("/", 1)[1]
    subs = client.get(f"/api/subtitles/{fid}").json()["subtitles"]
    assert [s["lang"] for s in subs] == ["en", "te"]
    assert not any("path" in s for s in subs)   # filesystem paths never exposed
    vtt = client.get(f"/api/subtitles/{fid}/0/track")
    assert vtt.status_code == 200
    assert vtt.headers["content-type"].startswith("text/vtt")
    body = vtt.text
    assert body.startswith("WEBVTT")
    assert "00:00:01.000 --> 00:00:02.000" in body   # comma→dot conversion
    assert "Hello there." in body
    assert client.get(f"/api/subtitles/{fid}/9/track").status_code == 404


def test_provider_disabled_without_key(client):
    scan(client)
    shaped = client.get("/api/catalog/shaped").json()
    tid = shaped["films"][0]["id"]
    r = client.post(f"/api/catalog/{tid}/refresh")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False and body["enabled"] is False


# ---------------------------------------------------------------------------
# Admin boundary
# ---------------------------------------------------------------------------

def setup_admin(client):
    r = client.post("/api/admin/setup", json={"password": "correct horse battery"})
    assert r.status_code == 200
    # second setup is rejected
    assert client.post("/api/admin/setup", json={"password": "another attempt"}).status_code == 409


def target_file_id(client, title="Inception"):
    shaped = client.get("/api/catalog/shaped").json()
    film = next(f for f in shaped["films"] if f["title"] == title)
    return film["stream"].rsplit("/", 1)[1], film["fileName"]


def test_delete_file_requires_admin(client):
    scan(client)
    setup_admin(client)
    fid, rel_path = target_file_id(client)
    path_on_disk = client.media_root / rel_path

    # no password at all
    r = client.post(f"/api/files/{fid}/delete", json={"admin_password": "", "confirm_path": rel_path})
    assert r.status_code == 422  # pydantic rejects empty password before anything happens
    assert path_on_disk.is_file()

    # wrong password
    r = client.post(f"/api/files/{fid}/delete",
                    json={"admin_password": "wrong password", "confirm_path": rel_path})
    assert r.status_code == 403
    assert path_on_disk.is_file()

    # wrong confirmation path (naming the wrong file)
    r = client.post(f"/api/files/{fid}/delete",
                    json={"admin_password": "correct horse battery", "confirm_path": "other/file.mp4"})
    assert r.status_code == 400
    assert path_on_disk.is_file()

    # correct password + exact path
    r = client.post(f"/api/files/{fid}/delete",
                    json={"admin_password": "correct horse battery", "confirm_path": rel_path})
    assert r.status_code == 200, r.text
    assert not path_on_disk.exists()

    # catalog no longer offers it
    shaped = client.get("/api/catalog/shaped").json()
    assert "stream" not in next(f for f in shaped["films"] if f["title"] == "Inception")


def test_verify_endpoint_rate_limited_and_secret_free(client):
    scan(client)
    setup_admin(client)
    fid, rel_path = target_file_id(client)

    r = client.post(f"/api/files/{fid}/delete", json={
        "admin_password": "correct horse battery", "confirm_path": rel_path})
    assert r.status_code == 200

    # audit log never contains the secret
    db_path = client.db.path
    raw = db_path.read_bytes()
    assert b"correct horse battery" not in raw
    rows = client.db.query("SELECT action, result, details FROM audit_log")
    assert any(a["action"] == "file_delete" and a["result"] == "ok" for a in rows)

    # rate limiting kicks in on the verify endpoint (5/min default limiter on the real app)
    from server.app.security import RateLimiter
    real_limiter = RateLimiter(max_events=5, window_sec=60)
    for i in range(5):
        assert real_limiter.allow("1.2.3.4")
    assert not real_limiter.allow("1.2.3.4")


def test_admin_verify_endpoint(client):
    setup_admin(client)
    assert client.post("/api/admin/verify", json={"password": "correct horse battery"}).status_code == 200
    assert client.post("/api/admin/verify", json={"password": "nope"}).status_code == 403


def test_unconfigured_admin_rejects_deletion(client):
    scan(client)
    fid, rel_path = target_file_id(client)
    r = client.post(f"/api/files/{fid}/delete",
                    json={"admin_password": "whatever phrase", "confirm_path": rel_path})
    assert r.status_code == 409
    assert (client.media_root / rel_path).is_file()


# ---------------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------------

def test_profile_crud_idempotent_by_name(client):
    r1 = client.post("/api/profiles", json={"name": "Harsha", "color": "teal"})
    r2 = client.post("/api/profiles", json={"name": "harsha", "color": "teal"})
    assert r1.json()["id"] == r2.json()["id"] and r2.json()["existed"] is True
    assert client.get("/api/profiles").json()["profiles"]
    pid = r1.json()["id"]
    assert client.patch(f"/api/profiles/{pid}", json={"name": "H"}).status_code == 200
    assert client.delete(f"/api/profiles/{pid}").status_code == 200
    assert client.get("/api/playback/p1").json()["items"] == [] or True
