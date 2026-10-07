# SENTINEL — UI Design Explanation

**Design language: "Y2K Cyber Console"** — a maximalist shell around a precise,
readable console. Deep navy base, azure `#2f89e3` accent, chrome text, CRT
touches — and one rule above all: *the whole console breathes the threat state*.

---

## 1. Layout architecture

```
┌──────────┬────────────────────────────────────────────┐
│ SIDEBAR  │  TOPBAR (view title + protection pill)     │
│ (glass)  ├────────────────────────────────────────────┤
│ 218px    │  .content — vertical flow of panels        │
│ glass    │  scrolls; padding 28px, 24px gaps          │
│ over the │  hero → stat row → two-column row → bento  │
│ dither   │                                            │
└──────────┴────────────────────────────────────────────┘
```

- `.shell` is a CSS grid: fixed 218px sidebar + fluid main column. It is
  also `position: relative` and anchors the **app-wide dither backdrop**
  (`position: absolute; inset: 0; z-index: 0`), so the living background
  spans the *entire* window — sidebar included.
- Sidebar and main sit at `z-index: 1` above it.
- `.content` is a flex column whose children are `flex-shrink: 0` — this
  guarantees content keeps its natural height and the page **scrolls**
  instead of silently compressing (the original cut-off-dashboard bug).
- Every decorative layer is `pointer-events: none` (`.dither-bg *` gets
  `!important`) so backgrounds can never eat a click.

## 2. The color system — one source of truth

All colors are CSS custom properties in `theme.css :root`:

| Token group | Values | Used for |
|---|---|---|
| Surfaces | `--bg-void #05081a`, `--bg-deep #070b1e`, `--bg-panel #0b1230`, `--bg-inset` | page, panels, inputs |
| Accent family | `--blue #2f89e3`, `--blue-bright #74b3f5`, `--cyan #47a8f0`, `--accent-rgb 47,137,227` | nav pill, buttons, glows, edge lines, meters, focus rings |
| Chrome text | `--chrome-hi/mid/lo` | gradient headings, big numbers |
| State colors | `--safe #3ee6a0`, `--warn #ffc46b`, `--danger #ff8a7a` + `--state`, `--state-dim`, `--state-glow` | protection pill, LED |
| Text tiers | `--text #d9e4ff`, `--text-dim`, `--text-faint` | 3-level readability hierarchy |

**Two independent color channels:**

1. **The accent** — currently azure `#2f89e3`. Everything decorative reads
   `var(--blue)` / `rgba(var(--accent-rgb), …)`, never a hardcoded hex.
2. **The state** — mint / amber / coral, the semantic "how bad is it" color.

### Threat-reactive recoloring

`state.tsx` holds one value (`safe | warn | danger`), fed by Rust telemetry
events, and writes it onto `<body data-threat="…">`. Three CSS blocks then
override the tokens:

- `warn` → accent family turns **amber** (`#cc8a2e` / `#ffc46b`)
- `danger` → accent family turns **deep threat red** (`#d7263d` / `#ff6b64` / `#ff4f5e`)

Because every component reads the variables, one attribute flip recolors
the entire console at once — nav pill, buttons, glows, edge lines, meters,
badges, focus rings. Escalation rules: warn raises safe→warn, danger
latches everything until "Reset Console"; a warn **auto-decays back to
azure after 15 s** (timer in `state.tsx`) so one suspicious file doesn't
poison the demo palette.

The **dither background** and **hero gradient** are WebGL, so they can't
read CSS variables — they receive colors as props from `ditherColors(level)`
in `App.tsx` (azure waves on deep navy when safe; amber; coral) and shift
in sync with the CSS side.

## 3. Sidebar — clean glassmorphism

The sidebar floats over the dither as a sheet of frosted glass:

- `backdrop-filter: blur(22px) saturate(150%)` melts the waves behind it
- a sheer white tint (`rgba(255,255,255, .11 → .05 → .08)` vertical gradient)
  — the panel gets its color *from the dither flowing behind it*
- 1px white hairline border + soft drop shadow for lift
- white nav labels (`Space Grotesk`-style display font, uppercase, subtle
  dark text-shadow for contrast)
- the **active item is a solid azure pill** — gradient `#3d97f0 → #2f89e3`,
  white border, inner top highlight, soft azure glow. On threat it follows
  the accent to amber/red automatically (it reads `var(--blue)`).

History: solid azure → dark textured liquid glass (noise + scanlines +
sweeping sheen) → current minimal glassmorphism. The textures were removed
deliberately: the dither itself is the texture.

## 4. Panels & the glow language

`.panel` and `.stat` share one treatment so every box feels related:

- gradient panel fill (`--bg-panel → --bg-deep`), 1px blue border, 14px radius
- **animated energy line** sweeping across the top edge of every box
  (`@keyframes edge-sweep`, 7 s loop) — constant ambient motion
- **cursor-tracked border glow**: a radial gradient masked to the border
  ring (`::after` + `mask-composite: exclude`) that lights the nearest box's
  edges cyan… i.e. accent-colored — driven by `useBoxGlow()` in `App.tsx`,
  which on every mousemove (rAF-throttled) sets `--glow-x/--glow-y/
  --glow-intensity` on each `.panel`/`.stat` with a 300 px proximity falloff.
  Same visual language as the MagicBento cards, applied app-wide.

## 5. Signature components

- **Hero** — `Grainient` WebGL gradient (3 animated colors + grain) with a
  sticker badge (rotated −2°, hard violet offset shadow), chrome-gradient
  SENTINEL title, mono status line. Colors follow the threat state.
- **MagicBento module grid** — 6 "Shield Modules" cards: hover particles,
  tilt, click ripples, spotlight border glow; spans full content width.
- **Password Lab instruments** — the "Analysis — live" panel is an
  instrument cluster, not text: a glowing **verdict ring gauge** (SVG arc +
  score pips), an **entropy meter** on a 128-bit scale with threshold ticks,
  a **crack-time meter** (white marker sliding on a red→amber→green scale),
  and **character-class chips** that light up per class + length meter.
  Tips render as compact ⚠/✓ pills.
- **LatticeLoader** during scans, **HoldButton** (press-and-hold) for vault
  destroy — motion carries meaning.

## 6. Typography

| Font | Role |
|---|---|
| Chakra Petch | display — headings, nav, buttons, big numbers (techy Y2K) |
| Space Grotesk | body copy |
| JetBrains Mono | logs, hashes, readouts, footers |

Labels are uppercase with wide letter-spacing (2px+) — the "console
instrument" look. Numbers get a soft accent glow text-shadow.

## 7. Atmosphere & motion

- CRT scanlines over the whole app (`body::after`, 1px repeating, ~1%
  white) + faint grid on `.main` + two radial vignettes on the body
- status **LED** pulses (2.2 s; **0.7 s in danger**) — peripheral alarm
- transitions 0.15–0.5 s ease; dither waves drift at 0.05 speed
- everything moves slowly and continuously so the app feels *alive* on a
  stage without distracting from the data

## 8. Decisions worth knowing

- **Why variables everywhere**: a retheme is a 4-line edit; the threat
  recolor is one attribute flip; no component owns a color.
- **Why glass on the sidebar**: it's the one place where the "app is a
  living thing" idea is physical — the console literally shows its own
  heartbeat (the dither) through its navigation.
- **Why the glow follows the cursor**: every box answers input → the UI
  feels responsive even when idle, and it unifies bento cards + panels.
- **Contrast**: white labels on glass, 3-tier text dimming, text shadows on
  glass — tuned for a projector.

## 9. File map

```
src/theme.css      tokens, threat-state overrides, panels, glow, glass, keyframes
src/App.tsx        shell, sidebar, dither wiring, ditherColors(), useBoxGlow()
src/state.tsx      threat level engine (telemetry listener, warn decay, body attribute)
src/views/*        Dashboard, ScanView, PasswordView, QuarantineView, ThreatLogView
src/components/ui/ Dither (raw-WebGL), Grainient, MagicBento, LatticeLoader, HoldButton
```
