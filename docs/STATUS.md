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
  **All data is MOCK** (locally bundled original key art/illustrations; no provider or real library
  connection, no playback).

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
- This remains a frontend-only prototype; real library data, playback capability badges and real
  progress are not implemented.

## Design research

- Apple TV web client captures + analysis under `~/Documents/HomeTheatre/AGENT_STATE/REA-RESEARCH/`
  (evidence IDs recorded; TV-specific behavior labeled as interpretation).
- Design system v0.1 in `docs/DESIGN.md`.

## NOT implemented (do not claim otherwise)

- Server, database, scanner, storage adapters, metadata providers, artwork pipeline.
- Playback (mpv/libmpv or browser video), progress sync, transcoding.
- Admin authorization (server-side deletion enforcement)  |  the CONFIRMED security boundary.
- Real library integration; the prototype never touches the filesystem.
- Production media-source mounting, multi-device indexing, provider metadata/artwork lookup, and
  server artwork caching. Settings entries are local demonstration data only.
- Android/TV/desktop native clients.

## Next

1. Choose the production server, storage access model, metadata/artwork provider policy, and artwork
   cache budget. Keep the provider optional and do not bake a full external catalog into clients.
2. Confirm backend, playback-engine, subtitle-provider, and supported-format decisions before
   implementing real playback or subtitle downloads.
3. Build a thin end-to-end slice from one indexed local media file through cached metadata/artwork to
   the client and playback, then add the server-enforced admin deletion boundary and audit trail.
