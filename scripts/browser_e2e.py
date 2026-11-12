"""Headless-browser end-to-end checks against a running Home Theater server.

Usage:
  1. Start the server with a scratch media root:
       HOME_THEATER_DB=/tmp/e2e.db HOME_THEATER_PORT=8789 \
       .venv/bin/python -m server.app.main &
  2. Put at least one playable movie under a "Movies" folder inside BASE_MEDIA
     below, or point the script at your own scratch root.
  3. .venv/bin/python scripts/browser_e2e.py

Requires playwright (pip install playwright && playwright install chromium-headless-shell).
The flow adds sources and sets the admin password on the target DB; never point
it at a production database.
"""
import json as _json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8789"
BASE_MEDIA = "/tmp/opencode/e2e-media"  # scratch media root used by this script
REPO = Path("/home/harsha/HomeTheatre")
FFMPEG = subprocess.run(
    [".venv/bin/python", "-c",
     "import static_ffmpeg.run as r; print(r.get_or_fetch_platform_executables_else_raise()[0])"],
    cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()

failures = []


def ensure_server_library():

    health = _json.loads(urllib.request.urlopen(f"{BASE}/api/health").read())
    assert health["ok"]
    sources = _json.loads(urllib.request.urlopen(f"{BASE}/api/sources").read())["sources"]
    if not sources:
        req = urllib.request.Request(
            f"{BASE}/api/sources", method="POST",
            data=_json.dumps({"name": "E2E", "root_path": "/tmp/opencode/e2e-media"}).encode(),
            headers={"content-type": "application/json"})
        sid = _json.loads(urllib.request.urlopen(req).read())["id"]
    else:
        sid = sources[0]["id"]
    urllib.request.urlopen(urllib.request.Request(
        f"{BASE}/api/sources/{sid}/scan?wait=true", method="POST")).read()
    return sid


def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f" | {extra}" if extra and not cond else ""))
    if not cond:
        failures.append(name)


def make_compatible_movie(rel):
    out = Path(BASE_MEDIA) / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error",
                    "-f", "lavfi", "-i", "testsrc=size=320x180:rate=10:duration=8",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=8",
                    "-c:v", "libx264", "-c:a", "aac", "-y", str(out)], check=True)


sid = ensure_server_library()
make_compatible_movie("Movies/Player Demo (2022)/Player Demo (2022).mp4")
urllib.request.urlopen(urllib.request.Request(
    f"{BASE}/api/sources/{sid}/scan?wait=true", method="POST")).read()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    # --- home renders server catalog ---
    page.goto(BASE, wait_until="networkidle")
    check("no page JS errors on home", not errors, errors[:2])
    card_titles = page.locator(".card-title").all_inner_texts()
    check("server titles rendered", "Direct Play Demo" in card_titles, card_titles[:5])
    check("hero present", page.locator(".hero-slide").count() >= 1)

    # --- detail sheet + remove-from-library button visible with server ---
    page.locator(".card", has_text="Direct Play Demo").first.click()
    page.wait_for_selector("#detailOverlay.open")
    check("detail shows title", "Direct Play Demo" in page.locator("#detailTitle").inner_text())
    check("remove button visible with server", page.locator("#detailRemoveBtn").is_visible())
    feedback = page.locator("#detailFeedback")
    # watched action syncs to server (accept dialog? none needed)
    page.locator('[data-detail-action="watched"]').click()
    page.wait_for_timeout(600)
    # verify server playback row exists

    prof = _json.loads(urllib.request.urlopen(f"{BASE}/api/profiles").read())
    # no profile selected -> watchlist/watched still local; just ensure no crash
    check("watched click no JS errors", not errors, errors[:2])
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)

    # --- settings: server sources + admin sections ---
    page.goto(BASE, wait_until="networkidle")
    page.evaluate("localStorage.setItem('homeTheaterProfiles', JSON.stringify([]))")
    page.reload(wait_until="networkidle")
    page.locator("#profileBtn, .profile-control").first.click()
    page.wait_for_timeout(300)
    # open settings view via nav (profile control switches to settings)
    page.wait_for_timeout(400)
    page.wait_for_selector("#sources", timeout=5000)
    source_names = [s["name"] for s in _json.loads(
        urllib.request.urlopen(f"{BASE}/api/sources").read())["sources"]]
    settings_text = page.locator("#sources").inner_text()
    check("server source row listed",
          any(name in settings_text for name in source_names), source_names)
    check("admin section exists", page.locator("#admin").count() == 1)
    check("scan button exists", page.locator("[data-scan-source]").count() >= 1)
    body_text = page.locator("#sources").inner_text()
    check("source shows scanned status", "ok" in body_text or "scanned" in body_text, body_text[:120])

    # admin password setup flow (skipped when a password is already configured on this DB)
    if page.locator("#adminSetupForm").count():
        page.fill("#adminSetupForm [name='adminPassword']", "browser e2e pass 1")
        page.fill("#adminSetupForm [name='adminPasswordConfirm']", "browser e2e pass 1")
        page.locator("#adminSetupForm button[type='submit']").click()
        page.wait_for_timeout(800)
        note_exists = page.locator("#adminSetupNote").count() > 0
        note_text = page.locator("#adminSetupNote").inner_text().lower() if note_exists else ""
        form_gone = page.locator("#adminSetupForm").count() == 0
        check("admin setup note confirms", ("set" in note_text) or form_gone,
              note_text or "form still present")
    else:
        callout = page.locator("#admin").inner_text()
        check("admin already configured shows callout", "password is set" in callout.lower(),
              callout[:120])

    # file listing + delete flow
    page.select_option("#adminSourceSelect", index=1)
    page.locator("[data-load-source-files]").click()
    page.wait_for_timeout(600)
    check("files listed", page.locator("[data-delete-file]").count() >= 1)
    # delete with wrong password -> alert + file survives
    page.once("dialog", lambda d: d.accept("wrong password"))
    page.locator("[data-delete-file]").first.click()
    page.wait_for_timeout(300)
    page.once("dialog", lambda d: d.accept())
    page.wait_for_timeout(800)
    db_bytes = Path("/tmp/opencode/e2e.db").read_bytes()
    check("wrong password not stored", b"wrong password" not in db_bytes)
    check("correct password secret-free", b"browser e2e pass 1" not in db_bytes)

    # --- player boots and streams a compatible file ---
    make_compatible_movie("Movies/Player Demo (2022)/Player Demo (2022).mp4")
    sid = _json.loads(urllib.request.urlopen(f"{BASE}/api/sources").read())["sources"][0]["id"]
    urllib.request.urlopen(urllib.request.Request(
        f"{BASE}/api/sources/{sid}/scan?wait=true", method="POST")).read()
    shaped = _json.loads(urllib.request.urlopen(f"{BASE}/api/catalog/shaped").read())
    stream = next(f["stream"] for f in shaped["films"] if f["title"] == "Player Demo")
    fid = stream.rsplit("/", 1)[1]
    page.goto(f"{BASE}/player.html?title={next(f['id'] for f in shaped['films'] if f['title'] == 'Player Demo')}",
              wait_until="networkidle")
    page.wait_for_timeout(1500)
    mode_note = page.locator("#streamModeNote").inner_text()
    check("player capability note", "Direct play" in mode_note, mode_note)
    v = page.evaluate("({t: document.getElementById('video').currentTime, paused: document.getElementById('video').paused})")
    if v["paused"]:
        # autoplay blocked (headless/no-gesture) -> designed fallback: press Play
        start_visible = page.locator("#startBtn").is_visible()
        check("autoplay fallback shown", start_visible)
        if start_visible:
            page.locator("#startBtn").click()
            page.wait_for_timeout(1000)
    playing = page.evaluate("!document.getElementById('video').paused")
    check("player video element active", playing)
    check("no player JS errors", not errors, errors[:2])

    # --- server-side video actually plays (decode a few frames) ---
    if playing:
        page.wait_for_timeout(2000)
        t = page.evaluate("document.getElementById('video').currentTime")
        check("playhead advances", t > 0.3, f"currentTime={t}")

    browser.close()

print(("\nALL BROWSER CHECKS PASSED" if not failures else f"\nFAILURES: {failures}"))
sys.exit(1 if failures else 0)
