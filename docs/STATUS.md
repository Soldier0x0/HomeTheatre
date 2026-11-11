# STATUS  |  what exists vs. what is planned

> Keep this file accurate. Do not describe planned work as done.

## Implemented (verified)

- `design/prototype/`  |  working TV-first UI prototype (vanilla HTML/CSS/JS, no build):
  top nav, auto-advancing hero with dots, film and series shelves, spatial focus engine (arrow keys /
  hover parity / Enter),
  detail overlay, user-created passwordless profiles with display-name and avatar-color controls,
  dedicated Settings page with three selectable themes, media-source entry demo, metadata/artwork
  choices, and performance preferences.
  Reduced-motion and high-contrast fallbacks.
  Data comes from the server when it is running (see vertical slice below); without a server the
  prototype falls back to the bundled sample catalog (locally bundled original key art/illustrations).

## Vertical slice (2026-11-12) — real server + catalog + playback

Implemented and verified by automated tests (`server/tests/test_slice.py`, 17 passing):

- **Server**: Python 3.12 + FastAPI + Uvicorn (`server/app/`), SQLite (WAL, foreign keys) with a
  versioned schema (media_sources, titles, seasons, episodes, media_files, artwork, profiles,
  playback_state, admin_auth, audit_log). Same server serves the prototype at `/` and the API at
  `/api` (OpenAPI at `/api/docs`). Run: `.venv/bin/python -m server.app.main` (127.0.0.1:8787).
- **Scanner**: walks configured media roots only; parses SxxEyy / 1x01 / `Season N` episode layouts
  and `Movie (Year)` names; reads NFO sidecars (title/year/plot/genres/cert; anime classification via
  anidb/anilist/mal/kitsu uniqueid or `<anime>`); picks up poster/fanart sidecars and episode stills.
  Incremental (size+mtime). Per-file errors are isolated and counted, never fatal.
- **Catalog API**: `/api/catalog/shaped` returns exactly the client's mock-data contract
  (hero/films/series; `isAnime` keeps anime out of Movies/Series shelves client-side). Titles without
  sidecar art get a deterministic gradient placeholder. `PATCH /api/catalog/{id}` stores manual
  corrections in `user_overrides` (rescan never overwrites them).
- **Client bridge**: `design/prototype/api.js` swaps `window.MOCK` for server data when
  `/api/health` responds and gates the app's init on it; syncs the active browser-local profile to
  the server for progress ownership. No server → sample data, clearly labeled.
- **Playback**: `player.html` (HTML5 video, ADR-0003) + `GET /api/stream/{file_id}` with full
  HTTP range support (206/416, byte-accurate verified). Resume per profile via
  `/api/playback/{profile}/{title}` (auto-watched at >95% duration); player saves every ~5 s and on
  page hide. Play/episode tiles in the UI launch the player when the server is present.
- **Admin boundary (server-enforced)**: `POST /api/files/{file_id}/delete` requires a scrypt-hashed
  administrator password (verified server-side, rate limited 5/min per address) *and* an exact-path
  confirmation equal to the indexed relative path. The submitted password never enters the database
  or audit log (test asserts the raw DB bytes contain no plaintext secret). Every attempt — denied,
  rate-limited, mismatched — is audited. `POST /api/admin/setup` bootstraps the verifier once.
- **Separate flows**: remove-from-library (`POST /api/catalog/{id}/remove`) and remove-source
  (`DELETE /api/sources/{id}`) drop catalog/index records only — tests assert the files survive on
  disk. File deletion is the only endpoint that touches media files, and it is admin-gated.
- **Profiles**: server CRUD (`/api/profiles`), passwordless, idempotent by name; playback rows are
  per (profile, title). Server-side profile management UI is not wired yet (browser-local profiles
  remain the UI of record this slice).
- **Known gaps (honest)**: movie runtimes come from NFO only (no media probing — ffprobe not
  integrated); watchlist/"watched" marks are still browser-local while playback progress is
  server-side; scans run synchronously on request; the admin password is set via API call only (no
  UI); no transcode/subtitle support.

## Latest visual refinement

- Replaced fictional film examples with real titles and metadata (including Dune: Part Two,
  Interstellar, Spider-Man: Across the Spider-Verse, Inception and Parasite). Poster/backdrop
  samples are bundled locally from TMDb and credited in the prototype footer. No live TMDb API,
  library, or playback integration exists.
- Progress bars are explicitly demo progress. They do not represent actual household viewing state.
- Home shelves now show Continue Watching, Movies, Series, and Anime. The two promotional-looking
  sample lanes are removed. Anime is a separate flag so films and series can share the Anime shelf
  without duplicating in the other categories; the current mock catalog has one anime series and no
  anime-film sample.
- Shelf cards show title and compact metadata below the artwork at rest. On focus, the full card
  enlarges and the title, year, genres, runtime, rating, and synopsis appear over the artwork in a
  translucent glass panel. Source artwork with its own title does not get a duplicate title overlay.
  The focus ring is attached to the card itself, so it follows the enlarged image and its dimensions
  cannot drift from the content. The separate “Selected” shelf panel remains removed.
- Hover changes focus without repeatedly scrolling the shelf; focus is applied once per card as the
  pointer crosses its content. Keyboard focus still scrolls a card into view. Click still opens the
  title detail sheet. Shelf rows reserve vertical breathing room so the enlarged card is not clipped
  by its horizontal scroller. The glass panel opacity was lowered slightly to let more artwork show.
- Home, Library, Discover, and Search now switch views. Library filters the sample titles by watch
  status, Discover filters by genre, and Search matches title, year, and genre. These interactions
  use only the local mock catalog; they do not call a server or metadata provider.
- Library, Discover, and Search keep a fixed column count when the result count changes, including
  empty cells for sparse results. Landscape settings persist Home/Search density (4–6, default 5)
  and Library/Discover columns (2–4, default 3). Portrait mode uses poster art and doubles those
  settings (8–12, default 10; 4–8, default 6) with smaller-screen column caps. Catalog views sort by
  title, year, IMDb rating, or runtime. IMDb values are date-stamped sample snapshots.
- The title detail sheet shows the full artwork above a separate information panel, with icon-only
  play, watchlist, and watched actions over the lower 20% of the artwork. Clicking the backdrop or
  pressing Escape closes it. Watchlist and watched choices persist in this browser; playback is a
  labeled mock action. Marking a title watched removes its demo progress and Continue Watching entry.
- Filter selection is singular after each change, and pointer focus clears when the pointer leaves
  a card. Visible em dashes were replaced with pipe separators.
- Desktop shelf rows have visible-on-hover previous/next paging controls; touch keeps swipe and TV
  navigation keeps D-pad focus movement. Focused cards preserve their label hit-area during the
  reveal animation to prevent hover oscillation.
- Settings now has independent sections for Appearance, Browsing Layout, Media Sources, Metadata and
  Artwork, and Performance. Midnight remains the default; Twilight Cinema and Cyber-Rust are
  selectable and persist in this browser. Multiple source entries can be added and removed in the
  demo. Paths are browser-local text only; they do not mount or scan storage.
- Cyber-Rust keeps the outer navigation capsule and active navigation control pill-shaped while
  retaining its sharper panels and buttons. The profile initials in the top bar are the single
  Settings entry. Profile selection is inside Settings, so no profile modal can trap the viewer.
- Media sources distinguish a local absolute path on the Home Theater server from a remote share's
  device name, host/IP, SMB/NFS protocol, share/export, and optional subfolder. The “Find devices”
  action explains that discovery needs the server; the prototype never pings or scans the LAN.
- The top bar uses one restrained two-tone screen mark and Home Theater wordmark without a circular
  badge or tagline. A theme-aware inline SVG drives the app; transparent PNG lockups are available
  for Midnight, Twilight Cinema, and Cyber-Rust. Profiles are user-created, renamed, recolored,
  selected, and removed in browser-local storage. The profile control opens Settings at the top,
  where Profiles is the first section.
- Added an explicit artwork fallback strategy and a resource-use explanation. The UI recommends
  local sidecars, optional provider matching, cached server artwork, title fallbacks, and low-priority
  optional episode-frame extraction. No provider credentials or file scanning are configured.
- Added locally bundled Arcane and SPY x FAMILY sample artwork. Opening a series shows a season
  selector and episode tiles with stills, names, runtimes, and short descriptions. Arcane demonstrates
  switching between two seasons. The view labels partial episode lists as sample tiles. Series and
  anime can also be found through the local Library, Discover, and Search mock catalog.
- Featured-year, hero metadata, and card metadata use pipe separators. The glass card details and
  progress line now sit within two pixels of the art edge.
- Title lettering flags apply only to poster artwork. Landscape backdrops always retain a visible
  title label, including The Grand Budapest Hotel and The Batman. Production clients must render the
  title from catalog metadata regardless of whether the artwork itself contains lettering.
- The profile control shows initials for the active user-created profile, or a plus sign before one
  exists. Profile display names and avatar colors are customizable; the prototype preloads no
  household names.
- This was a frontend-only prototype; it now renders real server catalog data when the Home Theater
  server is running (see the vertical slice section above). With no server, the bundled sample data
  is used and no filesystem access happens.
- The TMDb sample artwork/IMDb snapshot data applies to the no-server sample catalog only; real
  server libraries index local sidecar metadata and art.

## Design research

- Apple TV web client captures + analysis under `~/Documents/HomeTheatre/AGENT_STATE/REA-RESEARCH/`
  (evidence IDs recorded; TV-specific behavior labeled as interpretation).
- Design system v0.1 in `docs/DESIGN.md`.

## NOT implemented (do not claim otherwise)

- Metadata providers, server artwork caching from providers, provider-based metadata enrichment
  (sidecar NFO/local art only). Settings' metadata choices are still local demonstration data.
- Transcoding, subtitle selection/download, mpv/libmpv playback engine, codec probing (ffprobe).
- Media-source mounting/monitoring, network share discovery, multi-device indexing.
- Server-side profile management UI (API exists; profiles remain browser-local in the UI).
- Production hardening: authentication beyond the admin boundary, HTTPS, multi-user concurrency
  testing at scale, background scan scheduler.
- Android/TV/desktop native clients.

## Next

1. Wire the Settings profiles/media-sources sections to the server APIs (create/rename/remove
   profiles server-side; add/scan/remove sources from the UI with health and last-scan display).
2. Admin password bootstrap UX plus the remove-from-library / delete-file flows in the UI
   (exact-target confirmation naming the file and path), backed by the existing server boundary.
3. ffprobe-based runtime/codec detection; per-file capability badges; transcode decision (mpv
   engine vs. server transcode) per the PROPOSED list in `docs/DECISIONS.md`.
4. Background scan scheduler with progress in the UI; metadata provider enablement policy.
5. Continue Watching across devices once profiles move fully server-side.
