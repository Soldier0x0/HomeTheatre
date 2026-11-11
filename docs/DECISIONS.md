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

## PROPOSED (not decided — do not silently adopt)

- mpv/libmpv playback engine; FFmpeg probe integration.
- Metadata provider (TMDb) enablement + credentials + cache budget.
- Subtitle provider + hash-sharing opt-in policy.
- Network share mounting vs. companion agent.
- Release platform matrix and packaging.
- Argon2id swap for the admin KDF.
