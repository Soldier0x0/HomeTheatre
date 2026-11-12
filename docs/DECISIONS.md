# DECISION RECORD | Home Theater

> Living record of consequential choices. Classifications: CONFIRMED (owner-decided), ADOPTED
> (agent-made, reversible, recorded per handoff §1.5/§9), PROPOSED (needs review).

## ADR-0001 | Server stack for the first vertical slice — ADOPTED 2026-11-12

**Decision:** Python 3.12 + FastAPI + Uvicorn for the API server; SQLite (stdlib `sqlite3`,
WAL mode, foreign keys ON) for persistence. The existing static prototype stays the client
shell, served by the same server.

**Rationale:** matches the recommendation recorded in the product brief and handoff §9;
minimal dependencies appropriate to a modest always-on home server; SQLite keeps deployment
trivial; reversible — data lives in one file, schema is versioned by `PRAGMA user_version`.

**Rejected for now:** Rust core (correct for performance later, slows the first slice),
SQLAlchemy/ORM layers (unnecessary for the slice), any message broker/redis (banned by brief §24).

**Tradeoff accepted:** sqlite3 stdlib instead of async driver — the scanner runs in a thread,
API handlers are light. Revisit at scale.

## ADR-0002 | Admin secret hashing — ADOPTED 2026-11-12

**Decision:** `hashlib.scrypt` (stdlib, memory-hard) with random salt, n=2^15, r=8, p=1.
Verify with `hmac.compare_digest`. Rate limit admin verification attempts in-memory
(5 per rolling minute per remote address). Audit rows never contain submitted secrets.

**Rationale:** brief proposed Argon2id; argon2-cffi is a native dependency the slice does not
need to install. scrypt is a modern KDF meeting the same boundary for a home server. Swapping
to Argon2id later touches one module (security.py). Recorded as reversible.

## ADR-0003 | First playback path — ADOPTED 2026-11-12

**Decision:** HTTP range streaming from the server (`GET /api/stream/{file_id}`) played by an
HTML5 `<video>` page (`design/prototype/player.html`). Capabilities reported truthfully:
direct play of browser-supported containers/codecs only (e.g., MP4/WebM); unsupported files
produce an explicit error. No transcode claims.

**Rationale:** proves the end-to-end slice (index → catalog → play → resume per profile)
without committing the long-term playback engine. mpv/libmpv remains a PROPOSED future engine.

## ADR-0004 | Client data bridge — ADOPTED 2026-11-12

**Decision:** `design/prototype/api.js` runs before the app; when `/api/health` responds it
replaces `window.MOCK` with server-shaped catalog data (`/api/catalog/shaped`) and sets
`window.HAS_SERVER`; the app then renders real records. Without a server the prototype keeps
its bundled sample data, clearly labeled demo. Profiles remain browser-local this slice
(server profiles API exists; wiring profile management to the server is a recorded next step).

**Rationale:** preserves the approved UI shell and mock/demo separation required by handoff §3/§11.

## ADR-0005 | Playback capability policy: direct play, honest transcode fallback — ADOPTED 2026-11-12

**Decision:** Every indexed file is probed with ffprobe (PATH binary first, then the
`static-ffmpeg` package, else "unknown"). `GET /api/stream/{file_id}` serves the file byte-exact
with HTTP ranges when the probe shows a browser-compatible container/codec set (mp4/webm/mov +
h264/vp8/vp9/av1 + aac/mp3/opus/flac/vorbis). Otherwise an on-demand transcode to fragmented MP4
(H.264/AAC via libx264) is streamed from ffmpeg stdout; `?transcode=force|auto|direct` and
`?start=` (seek = restart ffmpeg at offset) are supported. Every reply carries an honest
`X-Home-Theater-Mode` header (`direct`/`transcoded`/`unavailable`). With no ffmpeg on the server,
an unprobed file, or an unknown file, the system direct-plays or reports an explicit error — it
never silently pretends.

**Rationale:** proves end-to-end playback for real libraries (MKV/HEVC/MPEG-2 material) while
keeping the direct-play path byte-accurate and range-complete. Server-side CPU transcode is the
reversible default; mpv/libmpv client engine stays PROPOSED for the native clients.

## ADR-0006 | Subtitles: local sidecars only — ADOPTED 2026-11-12

**Decision:** Subtitle support covers `.srt` sidecars beside the video (`<stem>.srt`,
`<stem>.<lang>.srt`). The server lists them (`/api/subtitles/{file_id}`) and converts to WebVTT on
the fly (`/api/subtitles/{file_id}/{index}/track`); the player offers a CC menu over native text
tracks. No external subtitle provider is integrated and none is contacted. Provider-based lookup
(hash matching, downloads) remains PROPOSED.

**Rationale:** real household value with zero external dependencies or privacy exposure; a
provider can be added later behind the same track interface.

## ADR-0007 | Scan model: background jobs in the server process — ADOPTED 2026-11-12

**Decision:** `POST /api/sources/{id}/scan` starts an in-process job (thread) and returns a job id
immediately; `GET /api/scan-jobs/{id}` reports state/result; `?wait=true` keeps a synchronous mode
for tests and small libraries; `?force=true` re-examines unchanged files (re-probe). The UI starts
scans, shows "Scanning…", polls, then refreshes the catalog. No broker/queue (brief §24 bans one);
the manager is in-memory and jobs are audited on completion.

**Rationale:** large libraries must not block the request path; single-process SQLite + threads is
sufficient at household scale. A durable job table is a recorded next step if scans become long.

## Metadata provider policy — ADOPTED 2026-11-12

TMDb enrichment exists (`POST /api/catalog/{title_id}/refresh`) but is **disabled unless
`HOME_THEATER_TMDB_KEY` is set in the server environment**. No key is ever stored in the repo or
sent to clients; remote artwork URLs are loaded directly by the browser only after opt-in. Titles
without a provider show filename metadata and deterministic gradient placeholder art.

## ADR-0008 | Data model: SQLite now, graph store deferred — ADOPTED 2026-11-12

**Decision:** All household data (catalog, people/credits, genres, collections, watchlist,
playback progress, profiles) lives in SQLite with plain relational modeling: join tables for
many-to-many relationships, recursive CTEs where traversal depth is needed. A graph database is
**deferred**, not rejected: if relationship queries ever outgrow SQL, the accepted future shape is
an *embedded* graph store (e.g., Kùzu) running as an optional sidecar fed from SQLite — **never a
networked dependency** (consistent with the no-broker/no-infra rule for this server).

**Rationale:** media-library relationships are shallow and enumerable (title↔person↔genre↔collection);
this is exactly what join tables were designed for, and SQLite at household scale is more than
sufficient (WAL, transactional, zero-ops). A graph engine earns its cost at recommendation scale
across many households, not one. Reversal cost is low: the shaped catalog API hides the storage,
so a sidecar graph could be introduced without client changes.

## Watchlist scope — ADOPTED 2026-11-12

Watchlist is **per-profile and server-side** (schema v3 `watchlist` table, keyed
`(profile_id, title_id)`), consistent with playback progress and watched state. Endpoints:
`GET/PUT/DELETE /api/watchlist/{profile_id}[/{title_id}]`; `shaped_catalog` returns `inWatchlist`
per item when a profile is supplied; profile deletion and title removal cascade the rows. The
browser keeps a localStorage mirror only as a fallback when no server is present.

## PROPOSED (not decided — do not silently adopt)

- mpv/libmpv playback engine for native clients (server-side on-demand transcode is the current
  adopted baseline, ADR-0005).
- External subtitle provider (hash matching, downloads) — sidecar-only support is adopted (ADR-0006).
- Hardware-accelerated transcoding (VA-API/NVENC) — only after GPU/driver/format verification.
- Durable scan-job table + cancellation for very long scans.
- Network share mounting (SMB/NFS) — UI form stays clearly labeled demo until implemented.
- Release platform matrix and packaging.
- Argon2id swap for the admin KDF.
