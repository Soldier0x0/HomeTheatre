# Home Theater  |  Design System v0.1

Source research: `~/Documents/HomeTheatre/AGENT_STATE/REA-RESEARCH/` (REA captures of tv.apple.com
with evidence IDs; TV-specific mechanics are **design interpretation**  |  see research limitations).
Direction confirmed by product owner: **TV-first 10-foot experience, Apple TV-inspired, original identity.**

## Principles (H1–H12)

See `~/Documents/HomeTheatre/AGENT_STATE/REA-RESEARCH/03-design-principles.md` for the full
observation → interpretation → application mapping. Summary:

| # | Principle |
|---|---|
| H1 | Artwork is the interface  |  full-bleed heroes, multi-variant artwork pipeline |
| H2 | One primary action per surface (white pill CTA; secondary = circle/text) |
| H3 | Restrained metadata chips; honest capability badges only |
| H4 | Progressive disclosure (2-line clamp + inline MORE) |
| H5 | Glass materials with @supports + prefers-contrast fallbacks |
| H6 | Focus/hover parity; on TV, focus-scale IS the selection feedback |
| H7 | Semantic a11y structure by construction |
| H8 | Stable opaque internal IDs + human-readable slugs |
| H9 | Lazy, virtualized, multi-variant artwork; never block input |
| H10 | Dark cinematic base; one restrained accent |
| H11 | Horizontal shelves as the browsing primitive (D-pad rows) |
| H12 | Quiet hero motion (slow crossfade/Ken-Burns, pause on input) |

## Design tokens v0.1

```css
--bg-black: #000;              /* page base / nav */
--bg-charcoal: #141416;        /* panels, cards */
--bg-elevated: #1e1e21;        /* overlays, glass fallback */
--text-primary: rgba(255,255,255,.96);
--text-secondary: rgba(255,255,255,.64);
--text-tertiary: rgba(255,255,255,.40);
--accent: #F5A524;             /* Home Theater amber  |  OWN identity, not Apple blue */
--accent-strong: #ffc14d;
--focus-scale: 1.075;          /* focused card scale; tuned to avoid crowding adjacent TV cards */
--focus-duration: 180ms;
--focus-easing: cubic-bezier(.2,.7,.3,1);
--crossfade: 300ms;
--radius-card: 14px;
--radius-pill: 999px;
--shadow-focus: 0 18px 48px rgba(0,0,0,.55);
--glass-blur: saturate(180%) blur(20px);  /* only where perf allows; TV uses scrims instead */
--font: system-ui / SF Pro stack;
```

## Components

HeroBanner, Shelf, MediaCard (landscape 16:9 / poster 2:3 variants), FocusRing, Chip,
PillButton, IconButton, ProgressBar, SeasonTabs, EpisodeCard, ProfileSwitcher, GlassPanel,
PlayerControls. TV implementation maps tokens to Compose; desktop/web to React; both from this spec.

## Motion rules

- 120–200 ms focus/scale, ease-out; 300 ms crossfade; parallax ≤4%.
- `prefers-reduced-motion`: scale → border highlight, crossfade → instant, Ken-Burns off.
- `prefers-contrast: more`: drop glass/blur, raise text contrast (H5).

## Prototype artwork and content refinement

The prototype uses real film examples with metadata and locally bundled TMDb backdrop samples.
Attribution and non-endorsement text appear in the footer. There is no live TMDb API or library
integration; continue-watching progress is clearly marked as demo data. Shelf cards use cinematic
landscape artwork inside one aligned card surface: art, label and expanded synopsis share one width,
background and outer border. At rest, title and concise metadata sit below the image on the page
canvas. Hover/D-pad focus lifts and scales the whole card, then reveals title, year, genres, runtime,
rating and synopsis in a lightly translucent glass panel over the art. Where source art carries its
own title lettering, the UI suppresses the duplicate overlay title. A focus ring is rendered on the
card itself, so it shares the exact transformed geometry instead of being measured and animated as
a separate element. Shelf rows reserve vertical space above the artwork so the focus scale does not
get clipped by the horizontal scroller. Hover does not scroll the row; a deduplicated pointer target
prevents repeated focus updates. The separate selected shelf panel remains removed. Home, Library,
Discover, and Search are interactive prototype views over the local mock catalog. Reduced-motion
behavior remains supported.

The sample Library and Discover grids use fixed, user-selectable column counts so sparse genres
do not enlarge a single card. Home shelves default to five visible cards (four to six configurable),
Search defaults to five columns, and Library/Discover default to three (two to four configurable).
The catalog sort control supports title, release year, IMDb snapshot rating, and runtime. Title details
use a full-width artwork region with three icon actions over its lower 20%, followed by a separate
glass information panel. Backdrop click and Escape dismiss the sheet. Browser-local watchlist and
watched state are prototype-only; play remains a labeled demo action.
The local catalog also includes Arcane and SPY x FAMILY as series examples, with bundled TMDb
artwork, a season selector, and sample episode tiles. The TV details sheet is scrollable so a long
series guide stays inside the viewport. Desktop shelf arrows are large edge controls with a light
translucent surface and sit above the card layer; the active button captures its click. Focused card
labels keep their layout space during the reveal, and the glass details panel and progress line
share the artwork edge with a two-pixel inset.

Home shelves use the stable order Continue Watching, Movies, Series, and Anime. Anime is a separate
classification for both anime films and anime series; anime titles do not repeat in Movies or Series.
The current mock library has an anime series example but no anime film sample yet. Recommendation
labels such as “A Great Place to Start” and “More Films” are removed from the Home layout.

## Theme variations and Settings

The prototype supports the existing Midnight default plus Twilight Cinema and Cyber-Rust. Theme
selection is available from a dedicated Settings page and is persisted in the current browser. These
are prototype-level CSS themes; real clients should map the same semantic theme tokens to native
components and respect contrast/reduced-motion settings.

Settings is a full page with sections for profiles, appearance, browsing layout, media sources,
metadata and artwork, and performance, with Profiles first. The Home Theater brand is one clean,
two-tone screen mark and wordmark at the top-left. The screen has no surrounding badge or circle and
the lockup has no tagline. Its SVG master uses theme tokens in the app; transparent PNG variants are
provided for Midnight, Twilight Cinema, and Cyber-Rust. Profiles start empty and can be created,
renamed, recolored, selected, and removed in the browser prototype; none of the demo profile names
are built in. The top-right profile control opens Settings at the page top.

The artwork-shape preference switches cards between wide backdrops and portrait posters. Counts
scale with the chosen shape: landscape defaults to five Home/Search cards and three Library/Discover
columns; portrait defaults to ten and six. Landscape ranges are four to six and two to four;
portrait ranges are eight to twelve and four to eight. Mobile/tablet caps retain readable cover
sizes.

Added source rows only save browser-local demo data. Local roots are paths in the Home Theater
server's filesystem. Remote roots require a device host/address, protocol, share/export, and server
access; a name or IP on its own does not grant access. The prototype's Find devices action explains
that discovery is not connected. Production discovery belongs to the server. Metadata and artwork
are resolved from local sidecars first or an owner-configured provider, cached by the server, and
served in display-sized variants. If no artwork is available, keep title text visible and use a
deliberate fallback. No GPU or AI model is needed for catalog matching and browsing; transcoding
acceleration is an optional, hardware-verified server capability. See `docs/ROADMAP.md` for the full
data and resource model.

Cyber-Rust preserves the rounded outer navigation capsule and pill-shaped active navigation item,
while using the theme's square geometry for utility controls and panels. Remote/keyboard focus
continues to move through navigation, shelves, Settings sections, and profile selection. Glass blur
is supported in Midnight/Twilight; high-contrast and performance-safe fallbacks remain available.
