# STATUS — what exists vs. what is planned

> Keep this file accurate. Do not describe planned work as done.

## Implemented (verified)

- `design/prototype/` — working TV-first UI prototype (vanilla HTML/CSS/JS, no build):
  top nav, auto-advancing hero with dots, three shelves (Continue Watching with progress,
  Top Movies, Recently Added), spatial focus engine (arrow keys / hover parity / Enter),
  detail overlay, passwordless profile switcher. Reduced-motion and high-contrast fallbacks.
  **All data is MOCK** (gradient placeholders, no network, no real artwork, no playback).

## Design research

- Apple TV web client captures + analysis under `~/Documents/HomeTheatre/AGENT_STATE/REA-RESEARCH/`
  (evidence IDs recorded; TV-specific behavior labeled as interpretation).
- Design system v0.1 in `docs/DESIGN.md`.

## NOT implemented (do not claim otherwise)

- Server, database, scanner, storage adapters, metadata providers, artwork pipeline.
- Playback (mpv/libmpv or browser video), progress sync, transcoding.
- Admin authorization (server-side deletion enforcement) — the CONFIRMED security boundary.
- Real library integration; the prototype never touches the filesystem.
- Android/TV/desktop native clients.

## Next (see ~/Documents/HomeTheatre/AGENT_STATE/CHECKLIST.md Phase C)

1. Confirm stack choices for the slice (recommend: FastAPI + SQLite; web client first).
2. Build thin vertical slice: one local media source indexed → shown in this UI → passwordless
   profile → playback starts → server-side admin delete authorization + audit.
