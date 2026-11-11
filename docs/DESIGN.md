# Home Theater — Design System v0.1

Source research: `~/Documents/HomeTheatre/AGENT_STATE/REA-RESEARCH/` (REA captures of tv.apple.com
with evidence IDs; TV-specific mechanics are **design interpretation** — see research limitations).
Direction confirmed by product owner: **TV-first 10-foot experience, Apple TV-inspired, original identity.**

## Principles (H1–H12)

See `~/Documents/HomeTheatre/AGENT_STATE/REA-RESEARCH/03-design-principles.md` for the full
observation → interpretation → application mapping. Summary:

| # | Principle |
|---|---|
| H1 | Artwork is the interface — full-bleed heroes, multi-variant artwork pipeline |
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
--accent: #F5A524;             /* Home Theater amber — OWN identity, not Apple blue */
--accent-strong: #ffc14d;
--focus-scale: 1.09;           /* focused card scale */
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
