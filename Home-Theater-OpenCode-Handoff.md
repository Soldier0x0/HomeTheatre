# Home Theater | OpenCode Product and Build Handoff

**Purpose:** Continue the existing Home Theater project from its current polished, TV-first UI prototype and build the real self-hosted product around it. This document is the working handoff for OpenCode. It distinguishes confirmed product decisions, current prototype behavior, implementation recommendations, and decisions that remain open.

**Project repository:** `/home/harsha/HomeTheatre`  
**Start by reading:** `README.md`, `docs/STATUS.md`, `docs/DESIGN.md`, `docs/BRAND.md`, and `docs/ROADMAP.md`.

---

## 1. Instructions to the coding agent

You are continuing an existing project. Do not start over or mistake the prototype for the production application.

1. Inspect the current repository and its working tree before changing anything. Treat the existing UI as the product's visual and interaction reference. Preserve its cinematic quality, interaction polish, and user-approved decisions. Do not replace it with a generic admin dashboard or a rough scaffold.
2. Read the five project files listed above. Treat `docs/STATUS.md` as the source of truth for what is implemented. Keep it accurate as work progresses.
3. Build toward the real product through a small, testable vertical slice. Do not attempt a multi-platform rewrite in one pass. Keep the UI usable and visually polished while adding real capabilities behind it.
4. Keep sample catalog entries and visual fixtures separate from production data. Production screens must render from API-provided records and handle empty, loading, error, missing-art, and offline-source states.
5. Treat every technical choice below as confirmed only where explicitly labeled **Confirmed**. Use the recommendations as starting points, document consequential choices in a decision record, and do not fabricate provider credentials, server addresses, media paths, supported codecs, or hardware capabilities.
6. Resolve reversible details autonomously. If a genuinely blocking product choice remains, make useful progress on independent work and ask the product owner one concise, concrete question with the impact explained.
7. Do not claim playback, scanning, subtitle lookup, storage mounting, multi-device sync, authorization, or TV compatibility until each is actually implemented and verified on its target.

### First session checklist

- Inspect `git status`, repository contents, and any existing project instructions before editing.
- Run the existing prototype locally and check the current UI before making changes.
- Record the current state and the first vertical-slice proposal in `docs/STATUS.md` or a short decision record.
- Identify the smallest useful end-to-end slice. Recommended starting point: one server-configured local media root, one scanned media file, a catalog record with cached artwork or a readable fallback, and a client view backed by the real API. Add playback only when the selected engine can report real capabilities.
- Keep the current UI as the client shell for the first slice unless inspection reveals a concrete technical blocker. Do not migrate frameworks as a matter of taste.

---

## 2. Product summary

Home Theater is a self-hosted household media library and playback product. It should feel like a premium home cinema experience, led by a 10-foot TV interface and adapted thoughtfully to desktop, mobile, and other clients. The product has its own identity; Apple TV and Netflix are interaction and quality references, not assets or branding to copy.

The system should let a household combine media from multiple storage roots into one catalog, browse and search that catalog, maintain separate passwordless viewing identities, and play available media with clear control over audio and subtitles. Resource use on a modest always-on home server matters. Scanning, metadata matching, art caching, and browsing must not require a GPU or a heavy AI model.

### Confirmed product rules

- Household profiles are passwordless to select. Each person can create and customize a profile; do not preload names such as Asha, Sahana, Guest, or Harsha.
- Deleting a media file requires an administrator password. The server must enforce this boundary. Never store the submitted secret in an audit record.
- “Remove from library” and “delete file” are different actions. Removing a catalog entry must not delete the underlying file. File deletion requires a deliberate confirmation that names the exact file and path, server-side authorization, and an audit trail.
- The home screen contains **Continue Watching**, **Movies**, **Series**, and **Anime**. Anime is its own classification and may contain anime movies and anime series. A title classified as anime must not be duplicated into the general Movies or Series shelf.
- Do not ship placeholder home rows such as “A Great Place to Start” or “More Films” as permanent categories. Recommendations are future work and need a clear, real data source.
- UI quality is a product requirement: cinematic, refined, polished, smooth, coherent, responsive, and usable by remote, mouse, keyboard, and touch input.

---

## 3. Current project and honest implementation boundary

The repository is currently a no-build, vanilla HTML/CSS/JavaScript prototype under `design/prototype/`.

### Existing files and what they mean

- `design/prototype/index.html`, `styles.css`, and `app.js` implement the interactive prototype and its TV-style focus behavior.
- `design/prototype/mock-data.js` contains the sample films, series, episode descriptions, demo progress, and artwork references. These are not the user's scanned files or live viewing state.
- `docs/DESIGN.md` records design principles, themes, layout behavior, and interaction details.
- `docs/BRAND.md` records the logo direction and exports.
- `docs/ROADMAP.md` records playback, source, artwork, subtitles, cross-device requirements, acceptance criteria, and unresolved choices.
- `docs/STATUS.md` is the current feature truth. Update it as product code is added.

### Implemented in the prototype

- Home, Library, Discover, and Search demo views backed by the local mock catalog.
- Continue Watching, Movies, Series, and Anime shelves, including series/season/episode examples.
- Card focus/hover reveal, a title detail sheet, sorting/filtering, fixed grid density, desktop shelf paging, and arrow-key remote simulation.
- Three themes: Midnight (default), Twilight Cinema, and Cyber-Rust.
- Settings page with profile editing, theme/layout controls, demo media-source entry, metadata/artwork options, and performance preferences.
- User-created passwordless profiles and some preferences are saved in this browser's `localStorage`.
- A vintage CRT-style brand mark with “HOME” and “THEATER” stacked, equal in type treatment, centered, and without an enclosing badge. Review the current logo against the supplied old-TV reference before modifying it.
- Reduced-motion and high-contrast fallbacks, plus desktop pointer/keyboard and touch-oriented interaction patterns.

### Not implemented

There is no real server, database, API, scanner, storage mount, metadata provider, live metadata/artwork resolution, server artwork cache, actual playback, real progress sync, subtitle selection/download service, admin authorization, audit log, Android app, Android TV app, or native desktop app. Source paths and profiles in the current prototype are browser-local demonstration state. The demo must not touch the filesystem or assume that a browser can mount or scan another device.

Some prototype content and design choices are fixed in source files. That is acceptable for a UI prototype; it is not acceptable as the production catalog or household state. New product code should treat movies, series, seasons, episodes, profiles, media roots, playback sessions, preferences, and available tracks as records supplied by persistent storage/API, not as UI constants.

---

## 4. UI and brand requirements

### Preserve and refine the existing UI

- Continue from the actual prototype in `design/prototype/`. Preserve the cinematic artwork-led home, its aligned card and focus geometry, the restrained three themes, and the established brand treatment.
- Keep “Continue Watching” and the three content categories. Do not reintroduce temporary promotional rows.
- A focused/hovered card should lift as one complete card, with its border aligned to artwork and details. Text, year, genres, runtime, and synopsis should stay readable without the card flickering when the pointer crosses its own metadata.
- Avoid card cropping at the top of a shelf. Keep geometry stable when filters return few or no items. Exactly one filter is selected in a single-select group; pointer/focus feedback is transient and visually distinct from selection.
- Desktop shelves need clear previous/next controls that do not trigger the card underneath. Touch supports swipe. TV remote navigation uses D-pad focus and scrolls focused content into view.
- Use theme-aware colors, typography, radii, and focus indicators. Cyber-Rust retains the outer pill navigation capsule and active navigation pill while using sharper styling elsewhere.
- Search results and suggestions must be from the household's indexed library, never a pretend streaming catalog.
- Keep title text available if artwork is missing or has no printed title. Avoid duplicate text where poster artwork already includes its own title, while landscape backdrops retain an accessible title label.
- The logo is a vintage television set, not a modern computer monitor. Its wordmark is HOME above THEATER, equal-sized/equal-weight lettering, centered together, with restrained two-tone coloring compatible with all three themes. Keep the background transparent and do not add a circle, badge, gratuitous glow, or tagline.
- The app name is **Home Theater** (two words). Keep branding original; use Apple TV/Netflix only as quality and interaction references.

### Settings requirements

Keep a dedicated Settings page. Profiles should be its first section and the top-right profile initials can remain the entry point. A settings route must open at the top rather than unexpectedly scrolling to a lower section.

Settings should grow into a real, organized place for:

- Profiles: create, rename, choose an avatar/color, select active profile, remove profile, and profile-specific playback/language preferences.
- Appearance: choose the three existing themes and browsing artwork shape.
- Browsing: home/search density and library/discover grid density with stable geometry and appropriate portrait/landscape defaults.
- Media sources: add, edit, validate, scan, pause/resume scan, show health and last scan, and remove a source without erasing media.
- Metadata and artwork: provider choice/configuration where authorized, local-first/fallback behavior, manual corrections, cache status/refresh, artwork role, and source priority.
- Performance: scan concurrency/throttling, pause or lower background work during playback, cache limits, and truthful server/client capabilities.
- Future playback settings only when the actual engine supports them.

TV settings must remain operable using only a remote. Desktop, phone, and tablet layouts should use their natural input method and readable target sizes.

---

## 5. Media storage, catalog, and artwork

### Multiple sources become one household library

A user may have files on the server's local disks and on another computer/NAS. The product should present one consolidated library while preserving the source and exact file association for each item. The household may add multiple roots and manage them independently.

For a remote network share, a device name or IP address alone is not access. The server needs a supported, authorized connection such as a mounted SMB/NFS share (or a later authenticated Home Theater agent). Store sufficient connection details server-side: host/address, protocol, share/export, optional subfolder, and protected credentials if required. Manual host entry is the fallback. Discovery may list advertised devices on the local network, but the user must explicitly choose and authorize a share before scanning. Do not implement browser ping sweeps or imply that a browser can enumerate LAN storage.

Paths and filesystem access stay on the server. The browser never scans arbitrary client paths. If the server cannot reach a remote file, it cannot index or stream that file. Show offline/unavailable state accurately.

### Recommended catalog model

Use stable opaque IDs. Keep source, file, catalog title, and artwork records linked rather than collapsing distinct files into one ambiguous object. At minimum model:

- `MediaSource`: owner-visible name, source type, server-side connection/path details, status, last scan, enabled state, and scan settings.
- `MediaFile`: source ID, canonical server path or safe server-side locator, file size, modification time, scan state, detected technical properties, and optional hash calculated only when needed.
- `Title`: movie or series identity, title variants, year, synopsis, genres, content rating, classification (including anime), and external identifiers where available.
- `Season` and `Episode`: stable relationship to series, season/episode numbers, title, synopsis, runtime, and available art.
- `Artwork`: owner/file/provider provenance, role (poster, backdrop, season, episode still), resolution/variants, cache location, attribution/rights note, and fallback state.
- `PlaybackState`: profile ID, item/file ID, position, duration, last played, and watched state.
- `Profile` and profile preferences: user-selected name/avatar, preferred audio/subtitle languages, and per-title overrides as needed.
- `MediaTrack`: stream index, type, language and display name when detected, codec/format, channel layout or subtitle flags, default status, commentary/audio-description/forced/SDH labels, and source. Preserve unknown values as unknown.

Treat this as a recommended starting schema, not a claim that it exists. Validate it against the chosen server/database and real scanner before locking it down.

### Metadata and artwork resolution

Do not bundle a full online film catalog or perform an internet lookup for every UI render. Use a layered, cache-first flow:

1. Read local sidecar/NFO metadata and conventional local art names where present.
2. If the owner enables and configures a provider, match by title/year and identifiers. Show candidate choices for ambiguous matches and allow manual correction.
3. Cache chosen metadata and appropriately sized artwork variants on the server. The client reads cached, display-sized assets from Home Theater.
4. If there is no match, retain a useful title and a designed fallback image. Let the owner supply art.
5. Episode stills may come from a provider or user-supplied files. Optional frame extraction should be low priority, configurable, and off by default until validated.

Use the highest suitable available resolution for the active screen without pointless upscaling. Lazy-load off-screen artwork and never block focus/navigation while an image decodes. Bound cache size and provide refresh/eviction behavior. Track provenance and licensing. Respect each provider's terms; provider selection, credentials, refresh policy, cache budget, and image rights remain open until chosen. No GPU/AI image recognition is required.

---

## 6. Playback and language controls

The desired player has familiar Netflix-like behavior while retaining Home Theater's visual identity and truthful engine capabilities:

- Play/pause, seek bar, elapsed/remaining or total time, and 10-second back/forward controls.
- Controls reveal on input, hide after inactivity, and can be restored using a TV remote even after hiding.
- An easily reachable lower-right audio/subtitle menu while playback controls are visible.
- Switch among every audio stream detected in the file, including alternate languages, commentary, and audio description when present and supported by the engine.
- Switch among embedded and available external subtitles, turn subtitles off, and identify language, forced, SDH/CC, and source.
- Subtitle search/download from within the player. Search by title/year/language and by file hash when supported by a selected provider. Show candidate, language, labels, source, and match reason/confidence before downloading.
- Downloaded subtitles are stored through the authorized server process, validated for type/size/path, and become selectable immediately. Never allow path traversal, unsafe overwrites, or an unapproved remote write.
- Preserve playback position while changing tracks. Resume state is per profile.
- Show detected language/track facts separately from provider-supplied or unknown metadata.

Do not promise track switching, direct play, subtitle rendering, seek behavior, or hardware acceleration unless the selected engine and client report support. Introduce a playback adapter/capability model if multiple clients or engines are planned. Prefer direct play. Treat transcoding and GPU acceleration as optional, explicitly tested capabilities; the integrated NVIDIA GeForce 920MX mentioned by the owner must not be assumed suitable without driver/codec validation.

Open choices include the playback engine per target, supported codecs/containers, direct play versus transcoding policy, subtitle provider(s), provider terms, hash-sharing privacy/opt-in, and whether downloaded subtitle files are shared across profiles.

---

## 7. Security and privacy boundaries

- Profile selection has no password/PIN.
- Any real file deletion is authorized by a server-side administrator password check. Do not protect it only in JavaScript, UI state, a client secret, or an untrusted header.
- Never log or persist the admin password in plaintext. Store any verifier using an appropriate password-hashing scheme selected for the server platform. Rate limit sensitive attempts and keep the audit record free of secrets.
- Audit actor/profile, timestamp, target title, exact file/path identifier, source, and result for destructive actions. Do not disclose sensitive connection credentials through API responses.
- Clearly separate catalog removal, source removal, and actual file deletion. Source removal must report the effect on indexed entries and must never silently delete media.
- Protect remote share credentials and metadata/subtitle provider credentials server-side. Do not put credentials in browser local storage or source control.
- Validate all paths and file operations against configured source roots; prevent traversal and symlink escapes according to the chosen storage policy.
- Ask before enabling external provider requests that reveal titles, hashes, or household behavior. Do not send watched-state or profile identity to providers unless an explicit product decision requires it.
- Do not invent credentials, real paths, hosts, or successful authorization.

---

## 8. Performance, accessibility, and device support

### Performance

- The server may be a modest always-on home machine. Keep scanning, matching, image resizing, and optional frame extraction bounded, low-priority background work.
- Make scan concurrency configurable; pause or throttle scans during playback.
- Prefer direct play. Make software or hardware transcoding an explicit capability and resource choice.
- Use stable pagination/virtualization where catalogs are large, cached image variants, lazy-loading, and responsive image sizes. Keep UI interactions immediate even while background work is running.
- Measure startup, browse/focus response, image load behavior, memory, and server CPU/disk/network use before claiming “smooth” or “efficient.” Do not add animation effects that make remote navigation laggy.
- Honor reduced motion and high-contrast preferences. Glass effects need readable fallbacks and should not become a performance requirement on TV.

### Target input behavior

| Device / input | Required behavior |
|---|---|
| Desktop browser | Mouse and keyboard; visible shelf paging arrows; trackpad horizontal scrolling; normal desktop keyboard for search. |
| Android TV / remote TV | D-pad focus, visible focus state, center/Enter activation, Back behavior, automatic shelf scrolling, TV on-screen keyboard and local-library suggestions. |
| Phone/tablet | Touch-first layout, swipeable shelves, no hover-only information, readable search with platform keyboard, comfortable touch targets. |
| Keyboard-only | Logical tab/arrow navigation, visible focus, Enter/Space activation, Escape/Back dismissal, no shortcuts hijacking text fields. |

Do not imply one web UI is a native Android TV/desktop/mobile deployment. First-release platform and packaging choices remain open.

---

## 9. Architecture and stack decisions

### Confirmed

- The current UI source is the existing static HTML/CSS/JS prototype.
- The product needs a real server boundary for filesystem scanning, storage access, authorization, shared catalog state, and playback services.
- Profiles are not authentication accounts. Server administrative actions require a separate server-enforced admin boundary.
- The system should support TV-first UX and adapt to other device types.

### Unresolved: do not silently choose

- Backend language/framework and database. Past discussion considered Python/FastAPI with SQLite and Rust components, but no final stack decision is confirmed.
- Whether the existing frontend remains the app (served/packaged and wired to an API) or a later client is rebuilt. Recommendation: retain it for the first server-backed vertical slice and only migrate after identifying a concrete limitation and recording the reason.
- First-release platform matrix and packaging: web, Tauri desktop, Android phone/tablet, Android TV, server container, or cross-compiled scanner binaries. Earlier CI package options were discussed but not selected.
- Storage adapters and whether the server mounts network shares directly or a later authenticated companion agent reports files.
- Metadata/artwork providers and credentials/terms.
- Playback engine, codec support, transcoding and subtitle provider.
- Database migration, backup, and restore policy.
- Whether internet access is required for metadata, subtitle lookup, or updates.

### Recommended architecture principles

- The server owns source configuration, scans, catalog records, metadata/art caches, admin checks, audit events, and shared household state.
- Clients use an explicit API and never access server filesystem paths directly. Define stable schemas and version the API where needed.
- Keep the UI mostly data-driven: components render records and capabilities rather than hardcoded titles or guessed playback features.
- Separate catalog/media adapters from UI and from playback engine. Keep provider secrets server-side.
- Keep background work queues bounded and observable, with retry/error states exposed in Settings.
- Keep dependencies and deployment choices appropriate for a small home server; do not add infrastructure that the thin slice does not need.
- Add a short architecture decision record whenever a choice affects migrations, client compatibility, security, or release packaging.

### Optional design research tool

The owner suggested [REA](https://github.com/morluto/rea) for reverse-engineering/reference analysis of Apple TV UI behavior. The repository currently describes itself as a reverse-engineering tool for app behavior through native binaries, with a TypeScript primary language and MIT license. Use it only as an optional research aid when useful; it is not a required runtime dependency, UI framework, or license to copy Apple's assets or branding. Record observed behavior separately from interpretation. Existing project research is under `~/Documents/HomeTheatre/AGENT_STATE/REA-RESEARCH/` if present.

Other visual references mentioned by the owner include [Apple TV](https://tv.apple.com/) for cinematic hierarchy and [CleanYourTV](https://cleanyour.tv/) for smooth TV focus/movement. Use these as behavioral/design references, not as source code or brand assets.

---

## 10. Recommended development sequence

### Phase 0 | Repository and architecture baseline

- Inspect and preserve the existing UI.
- Record unresolved stack/platform choices in an ADR. Avoid a broad rewrite.
- Define a small API contract and data model for one media source, one scanned file, title metadata/artwork fallback, and one profile's viewing state.
- Decide test strategy and basic packaging only for the chosen thin slice.

### Phase 1 | Real inventory vertical slice

- Add a server process and persistent database using the chosen, explicitly documented stack.
- Allow an administrator to configure one local server-side media root.
- Scan only that authorized root, record files safely and incrementally, and expose status/errors.
- Return one or more catalog items through the API. Render loading/empty/error states in the current UI.
- Use local sidecar metadata/art first, optional provider lookup only if chosen, cached artwork, and a proper no-art fallback.
- Keep source paths server-side. The client receives safe display information only.

### Phase 2 | Profiles and catalog behavior

- Persist user-created profiles on the server and assign watchlist/watched/resume state per profile.
- Connect home, Library, Discover, Search, filters, sort, and artwork shape/density to real catalog records.
- Preserve stable shelves and grid geometry for zero, one, or many results.
- Add source health and catalog refresh behavior.

### Phase 3 | First real playback client

- Select the first client and playback engine based on target hardware and supported formats.
- Implement real play, pause, seek, resume, progress persistence, and truthful capabilities.
- Verify desktop/mobile/TV interaction only where implemented.
- Add audio/subtitle track selection that the engine actually supports.

### Phase 4 | Safe destructive actions and source expansion

- Add separate remove-from-library and delete-file flows.
- Implement server-side administrator password verification, exact-target confirmation, rate limiting, and secret-free audit log.
- Add network share support/discovery only after the storage approach and credential handling are decided.
- Handle offline sources and duplicates without losing source/file provenance.

### Phase 5 | Subtitle service and multi-client releases

- Choose subtitle provider and privacy behavior; then implement in-player search, candidate confirmation, safe download, storage, and track refresh.
- Add platform clients and release packages only after the supported target matrix is chosen.
- Validate remote input, TV search keyboard, responsive layouts, accessibility, performance, and packaging on actual supported targets.

Avoid implementing all phases before delivering value. Each phase should leave a usable, reviewable product state and an accurate status document.

---

## 11. Acceptance criteria

### Data-driven behavior

- Adding or removing a catalog record through the backend changes visible shelves/search without editing UI source.
- The UI accepts empty, incomplete, offline, and large result sets without broken layout or false content.
- Profiles are created by users, not source constants. Profile-specific watchlist, watched, language preference, and resume state remain separate.
- Media roots can be added/edited/removed as records. A displayed path is never treated as proof of a successful mount or scan.
- Sample data is isolated from production data and clearly labeled in demo/development mode.

### Library and artwork

- A configured source scan can be started, observed, stopped/paused where supported, and retried after errors.
- Only configured/authorized server roots are scanned.
- Catalog records retain their source/file links; offline files are reported and do not silently disappear.
- Artwork uses server-cached variants where configured, has provenance, lazy-loads, and falls back to readable title text and deliberate art.
- Movies, Series, and Anime shelves classify each title once according to its metadata.

### Playback and profiles

- A supported media item plays using the selected engine and reports actual capability details.
- Progress/resume is stored against the active profile and survives application restart.
- Audio/subtitle switching works without resetting position when supported; unsupported operations are unavailable or clearly explained.
- A downloaded subtitle is validated, selectable in the current player session, and remains available after restart.

### Security

- Passwordless profile selection does not grant admin rights.
- Delete-file requests without valid server-side admin authorization fail, even if the UI is bypassed.
- The exact target is confirmed, audit events have no secret, and path traversal cannot escape configured roots.
- “Remove from library” leaves the file untouched. “Remove source” has an explicit effect on index records and does not delete media.

### Cross-device and quality

- Desktop has shelf arrows and mouse/keyboard controls; TV has remote-only navigation; mobile has touch-first controls.
- Search on TV invokes the platform keyboard and searches only local indexed titles.
- Reduced-motion, high-contrast, keyboard access, and readable focus states work.
- Sparse result counts preserve configured layout. Card focus never flickers from hover-target oscillation or clips out of the shelf.
- Performance claims are supported by measurements on the intended server/client, especially with scanning in the background.

---

## 12. Do not do

- Do not claim the current prototype is the production tool or that its browser-local source list scans files.
- Do not hardcode household profile names, real library titles, credentials, hostnames, IP addresses, or media paths into production code.
- Do not bundle a complete online media catalog in a client or fetch artwork on every hover/render.
- Do not require GPU/AI recognition for scanning, matching, artwork, or browsing.
- Do not ping-sweep a LAN or give the browser filesystem access.
- Do not conflate removing a title from the library with deleting its file.
- Do not trust client-side-only admin protection or expose admin/share/provider secrets to clients.
- Do not promise playback, a track option, hardware transcoding, or platform support that the runtime has not reported and the target has not verified.
- Do not reintroduce temporary “recommendation” home categories or duplicate anime titles in general Movies/Series shelves.
- Do not redesign or replace the current interface wholesale, change the logo away from the vintage CRT/equal centered wordmark direction, or introduce generic dashboard styling without concrete evidence and owner review.
- Do not copy Apple/Netflix/CleanYourTV assets, logos, proprietary source, or exact branded UI. Build an original Home Theater identity.
- Do not choose CI target breadth, native app matrix, or backend/playback/provider stack by silently selecting an option from an old exploratory question.

---

## 13. Suggested first prompt for OpenCode

> Continue the existing Home Theater project in `/home/harsha/HomeTheatre`. Read `README.md`, `docs/STATUS.md`, `docs/DESIGN.md`, `docs/BRAND.md`, `docs/ROADMAP.md`, and `Home-Theater-OpenCode-Handoff.md` first. Preserve the current polished, cinematic UI and the confirmed product decisions. The current app is only a vanilla HTML/CSS/JS prototype with mock catalog data and browser-local settings; it has no backend, scanner, real playback, server authorization, or production source access.
>
> Start by inspecting the repository and running the prototype. Do not rewrite the UI or invent credentials, media paths, or product decisions. Propose and document the smallest real end-to-end vertical slice: one server-configured local media root, one indexed media file, persistent catalog metadata with cached artwork or a readable fallback, and the existing client rendering real API data. Keep title/profile/source/watch state data-driven and persisted appropriately. Keep all filesystem access and admin enforcement on the server. Profile selection is passwordless; deleting an actual file requires separate server-side admin authorization and an audit record. Removing from the library must never silently delete the file.
>
> The backend/database, playback engine, metadata provider, subtitle provider, network storage approach, and release platform matrix are not final decisions. Recommend options with tradeoffs and record them; proceed with independent reversible setup work, but ask me before a choice that locks in a major architecture or has privacy/security consequences. Keep the current frontend for the first slice unless you can demonstrate a concrete limitation. Update `docs/STATUS.md` truthfully after each implementation phase, and do not claim functionality until it is implemented and verified.

---

## 14. Reference file list

- Product overview and confirmed rules: `README.md`
- Current implementation truth and gaps: `docs/STATUS.md`
- Design principles, theme, brand, and prototype interactions: `docs/DESIGN.md`, `docs/BRAND.md`
- Source, metadata/artwork, playback, subtitle, device, performance, acceptance, and open decisions: `docs/ROADMAP.md`
- Current UI: `design/prototype/index.html`, `design/prototype/styles.css`, `design/prototype/app.js`
- Current sample catalog: `design/prototype/mock-data.js`
- Optional REA research tool: [morluto/rea](https://github.com/morluto/rea)
