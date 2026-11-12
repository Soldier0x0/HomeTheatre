# Home Theater | Playback and Multi-Device Roadmap

This document captures product requirements and implementation guidance for the next product
phases. It does not claim that a server, player, subtitle service, TV client, or mobile client exists.

## Confirmed product requirements

### Home organization

- Keep Continue Watching as a dedicated row, then separate the home catalog into Movies, Series,
  and Anime. The Anime category contains both anime movies and anime series, and those titles do not
  appear again in the general Movies or Series rows.
- Do not ship temporary recommendation headers such as “A Great Place to Start” or “More Films” as
  fixed product categories. Curated recommendation rows can be added later when there is a real
  household-aware recommendation source and clear value to the viewer.

### Library sources and consolidated indexing

- Let an administrator add multiple media roots, including local disks and network-mounted sources.
- For network storage, record the hosting device name/address, protocol, share/export, and optional
  path within the share. A friendly label is optional and does not replace connection details.
- Where supported, let the Home Theater server discover advertised media servers on the local
  network, with manual host entry as a fallback. A discovery result must still be explicitly chosen
  and authorized before it is mounted or scanned.
- Present every configured source as one household library, while retaining which source and file each
  item came from so missing, offline, or duplicate storage can be explained.
- Keep source paths and filesystem access on the authorized server. A browser client must never scan
  arbitrary local paths or receive broad filesystem access.
- Provide a separate Settings page for appearance, media roots, metadata and artwork, scanning,
  performance, and future playback preferences. Make the controls understandable with a remote,
  mouse, keyboard, or touch input.
- Offer wide backdrop and portrait poster browsing modes. Keep a larger card/grid count for portrait
  artwork while preserving readable minimum sizes and sensible mobile caps.
- Use the active profile's initials in the top bar as the Settings entry point. Keep profile
  switching in Settings, not in a modal that traps the viewer.

### Metadata and artwork

- Match scanned files to movie, series, season, and episode records. Let the household correct a wrong
  match and keep a useful title display when metadata or artwork is unavailable.
- Support local sidecar artwork and metadata, an optional provider lookup, and a manual correction
  path. Keep artwork cached locally so rendering a shelf does not make a live metadata request.
- Handle different artwork roles, including poster, backdrop, season art, and episode stills. Allow
  the household to supply art when a provider has no match.
- Do not require AI recognition or a GPU to index files, match known metadata, cache images, or browse.

## Recommended implementation model

### Sources and server boundaries

Represent each configured root as a library source with an owner-chosen display name, server-side
path, source type, scan status, and last successful scan. A scanner walks only those approved roots
and records file identity, size, modification time, media streams, and title matching evidence in
the central catalog. Use stable media IDs and preserve the source/file association when merging
results. Detect duplicates using inexpensive file facts first; request full hashing only for a
specific feature that needs it, such as subtitle matching.

For storage on a second computer, require one of two explicit arrangements: mount its share on the
Home Theater server using a supported network filesystem, or later add a separately authenticated
Home Theater agent that reports indexed files. If the server cannot reach the remote files, it
cannot scan or stream them. Do not imply that entering a path into the web app mounts a disk.

Do not use a client-side ping sweep as a substitute for discovery. ICMP reachability only says that
a host may respond; it does not list shares, establish identity, or grant access. Browsers also do
not provide general LAN enumeration or direct access to another computer's filesystem. Production
discovery should run on the Home Theater server using advertised services (for example, mDNS/SSDP)
within a deliberate local-network scope, then ask the owner to select a device and authorize its
share. Manual hostname/IP entry remains necessary when discovery is unavailable. Store share
credentials on the server using its protected secret mechanism, never in browser local storage.

### Metadata and artwork resolution

Use a layered resolver rather than bundling a static catalog or searching for art on every page view:

1. Read local NFO/sidecar metadata and recognized local artwork names such as `poster.jpg` and
   `folder.jpg` when available.
2. If the owner enables a provider and configures it on the server, search by title, year, and media
   identifiers. Show candidates for ambiguous matches and let the owner correct them.
3. Cache selected metadata and image variants on the server, indexed by title/season/episode and
   artwork role. Clients request cached, appropriately sized images from the Home Theater server.
4. If no match exists, show a designed title fallback and offer manual metadata/artwork selection.
   Episode stills can come from the metadata provider or user-supplied local artwork. Optional frame
   extraction is a low-priority background job with a way to disable it.

This approach avoids embedding a large film database, sending a request for every card, or asking
the GPU to identify artwork. Provider terms, credentials, refresh rules, and image redistribution
rights must be chosen before enabling a real provider.

### Resource use on the home server

Indexing, metadata matching, image resizing/caching, and the UI are CPU/disk/network work and should
not require graphics acceleration. Prefer direct play when the client supports the media. Treat
hardware video transcoding as an optional capability only after testing the exact GPU, driver, and
codec combination; otherwise use direct play or a clearly limited software-transcode mode. Keep
background jobs low priority, limit parallel scans, pause or throttle them during playback, and make
episode frame extraction optional. This keeps a small integrated/entry-level GPU from being a
requirement for the product.

The prototype Settings screen can demonstrate local preferences and source entries, but cannot
validate paths, mount network shares, scan files, call providers, or store server credentials. Those
actions belong to the later server and its authenticated administration boundary.

### Playback and language controls

- Provide a cinematic player with familiar play/pause, seek, and progress controls. The visual
  direction may take behavioral inspiration from Netflix while keeping Home Theater's own identity.
- Let viewers switch between every audio track present in the media, including alternate languages,
  commentary, and audio-description tracks when available.
- Let viewers switch between embedded and available external subtitle tracks while playback is open.
- Keep an always-reachable audio and subtitle menu in the player's lower-right control area. Track
  changes should take effect without leaving playback whenever the media engine supports it.
- Make subtitle discovery and download available from inside the player. Search should support
  title, year, language, and release/file hash matching where a provider supports it. A viewer must
  see the language, forced/SDH labels, source, match confidence, and candidate before choosing it.
- Show available audio and subtitle languages in title details when the scanner has detected them.
  Distinguish detected track facts from provider-supplied language metadata and from unknown values.

### Playback controls

- Include play/pause, a seek bar with elapsed and remaining or total time, and 10-second forward and
  backward actions.
- On desktop and mobile, make these controls available to pointer, keyboard, and touch input as
  appropriate. On TVs, make them usable with a remote and visible spatial focus.
- Keep track selection reachable while the transport controls are visible. Auto-hide controls after
  inactivity, and reveal them again on input. Provide a clear way to bring them back with a remote.
- Preserve playback position while changing audio or subtitles. Resume state is per household profile.

### Input and layout by device

| Target | Required interaction |
|---|---|
| Desktop browser | Mouse and keyboard support. Shelf arrows provide explicit horizontal paging. Trackpad horizontal scrolling remains available. Search uses the desktop keyboard. |
| Android TV and other remote-controlled TVs | D-pad navigation, visible focus, Enter/center selection, Back behavior, and automatic shelf scrolling. Search focus opens the platform's on-screen keyboard and presents matching library suggestions. |
| Phone and tablet | Touch-first layout, swipeable shelves, no hover-only information, a readable search field with the platform keyboard, and comfortable touch targets. |
| Keyboard-only use | Tab and arrow navigation, clear focus, working Enter/Space activation, and Escape/Back dismissal. |

The layout should adapt controls to the input device. It should not require a desktop mouse, assume a
TV has a pointer, or force a desktop-style grid onto a phone.

### Library browsing consistency

- Keep shelf and grid geometry stable as filters and search results change. A sparse genre must not
  inflate one card to fill the screen.
- On desktop, provide visible previous/next shelf controls. On touch devices, preserve swipe. On TVs,
  use D-pad movement and scroll the focused card into view.
- Keep selected filter state distinct from transient pointer or remote focus. There must be exactly
  one selected filter in a single-select group.
- Search suggestions must come from the indexed local library. Do not suggest titles the household
  does not have as if they are playable.

### Artwork quality

- Prefer the highest suitable locally cached or provider-supplied resolution for the active display.
- Preserve source aspect ratio and use the correct poster, backdrop, season, or episode artwork role.
- Do not upscale a low-resolution image when a better source is unavailable. Use a deliberate
  fallback image and retain the title as readable text.
- Load visible artwork first, lazy-load off-screen rows, and avoid blocking navigation while images
  decode. Cache artwork with bounded storage and allow it to be refreshed when metadata changes.
- Keep artwork provenance and licensing requirements documented. Do not imply that sample artwork
  is the household's real media artwork.

## Recommended product details

These are recommendations to make the requested behavior complete. They should be reviewed during
the relevant design phase, not treated as existing implementation or credentials.

### Track metadata model

For each audio track, record the stream index, language tag and display name, codec, channel layout,
default status, commentary status, and audio-description status when available. For subtitles, record
the stream index or sidecar path, language, format, default/forced/SDH flags, and source. Preserve
unknown values as unknown; do not infer a language solely from a filename.

Show friendly labels such as `English | AAC | 5.1` or `Japanese | subtitles | SDH`. Offer `Off` for
subtitles and clearly mark the currently active track. Use codec and channel details as supporting
information rather than making viewers decode raw stream identifiers.

### Subtitle discovery and download

- Define a provider adapter so services can be added without coupling the player to one provider.
- Prefer a release/file-hash match when supported, then offer title, year, language, and edition
  matches as fallback. Show why a candidate matched and let the viewer choose.
- Let the viewer filter languages and distinguish forced subtitles, SDH/closed captions, and
  standard subtitles. Include a no-results state and retry path.
- Store downloaded subtitles beside the media only through the authorized server process. Validate
  file type, size, path, and filename; prevent traversal and overwrite. Make the selected sidecar
  visible in the track menu after download.
- Treat sending a media hash to an external subtitle service as a privacy decision. Keep provider
  selection and any account credentials unresolved until the owner chooses them. Never invent or
  embed credentials.

### Subtitle and language preferences

- Let each profile set preferred audio and subtitle languages, subtitle on/off behavior, and a
  preference for forced subtitles. Provide per-title overrides.
- Allow subtitle size, contrast/background, position, and synchronization offset adjustments.
- Include accessible audio description and SDH tracks when available, and make the active track
  state perceivable to assistive technology.

### Cross-device player behavior

- Use a playback-engine adapter with explicit capability reporting for supported codecs, audio
  switching, subtitle switching, subtitle formats, seeking, and resume. The UI must reflect actual
  capabilities rather than promise unsupported actions.
- Keep the transport controls predictable: center play/pause, 10-second seek controls, time and
  progress, then a compact audio/subtitle entry at the lower right. On a TV, preserve a simple D-pad
  focus order and Back behavior. On mobile, avoid tiny controls and provide a clear touch target.
- Add a control-reveal affordance that works with a remote even after auto-hide. On desktop, keyboard
  shortcuts must be discoverable and must not hijack typing in search or text fields.

## Implementation phases

1. **Interaction foundation:** complete desktop shelf arrows and stable card hover hit areas in the
   web prototype. Confirm touch swiping and keyboard/D-pad focus rules across Home, Library,
   Discover, and Search. — *done (prototype, verified visually; device QA remains phase 6).*
2. **Media inventory:** choose the server and playback stack, scan real files, and expose media
   duration, stream indices, audio languages, subtitle languages, and track flags through the API.
   — *largely done 2026-11-12: FastAPI/SQLite (ADR-0001), ffprobe duration/codec/language detection,
   capability endpoint. Per-file stream indices are still collapsed to "first video + first audio"
   in the transcode path; full track tables are the remaining gap.*
3. **Playback baseline:** implement play/pause, seeking, progress, resume, and truthful capability
   reporting for the first supported client. — *done for HTML5 video: direct play with HTTP ranges,
   on-demand transcode with seek-restart (ADR-0005), resume + progress sync, capability note in the
   player, sidecar subtitle menu (ADR-0006), explicit errors when playback is impossible.*
4. **Track controls:** implement audio selection, embedded subtitle selection, subtitle preferences,
   and per-profile persistence.
5. **Subtitle lookup:** select a provider, implement hash and metadata matching, download validation,
   sidecar storage, and in-player candidate selection.
6. **Device input QA:** validate remote, desktop keyboard/mouse, and phone/tablet touch behavior on
   their target devices. Keep shared product behavior consistent while allowing device-appropriate
   layouts.

## Acceptance criteria

- A file with multiple audio tracks lists each detected language and useful format details; changing
  tracks does not restart playback or reset the playhead when the engine supports seamless switching.
- A file with embedded subtitles can switch tracks and turn subtitles off without leaving playback.
- Subtitle lookup can search by title/year/language and by file hash when available, displays match
  context, and downloads only after the viewer chooses a result. A downloaded subtitle is selectable
  immediately and survives app restart.
- 10-second backward/forward controls move the playhead by the expected interval, bounded by the
  start and end of the media. Play/pause and resume work with the active input method.
- TV users can reach every playback action and language option using only a remote. Focusing Search
  invokes the platform keyboard and results are drawn from the indexed household library.
- Desktop users can page a shelf with visible controls. Pointer movement across card art and its
  metadata does not cause the card, row, or focus border to shimmer or repeatedly enter/exit focus.
- Phone/tablet users can swipe shelves, use the player controls without hover, and operate controls
  at touch-friendly sizes.
- Filter and search result counts do not change the configured grid geometry. The selected filter
  remains singular and visually distinct from focus.
- Artwork uses an appropriate high-resolution variant when available, preserves aspect ratio, and
  keeps title text available when art is missing or textless.
- Reduced-motion, high-contrast, captions, keyboard focus, and screen-reader labels are included in
  playback and browsing verification.

## Open decisions

- Backend and playback engine for each target platform. — *server baseline adopted (FastAPI +
  SQLite + on-demand transcode, ADR-0005); playback engine for native clients still open:
  browser HTML5 video is the web baseline, mpv/libmpv remains proposed.*
- Subtitle provider(s), provider terms, supported languages, and whether hash lookup is opt-in. —
  *local sidecar subtitles adopted (ADR-0006); external providers remain open.*
- Supported audio/video/subtitle formats and the policy for direct play versus transcoding. —
  *policy adopted (ADR-0005): direct play of probed browser-compatible files, on-demand H.264/AAC
  transcode otherwise, honest mode headers and explicit errors. Format list remains conservative.*
- Which TV platforms are in the first release and their remote/IME APIs.
- Whether downloaded subtitles are shared across household profiles or stored per profile.
- Whether language preferences are global per profile, per title, or both.
- Artwork metadata provider, cache limits, refresh policy, and any user-configurable source priority.

Until these decisions are made, use capability interfaces and local fixtures in design work. Do not
claim real playback, live subtitle search, downloads, or cross-device compatibility in the prototype.
