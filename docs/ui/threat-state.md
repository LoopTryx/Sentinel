# Threat-state presentation spec (UI-01 / issue #10)

How the Y2K Cyber Console represents Sentinel state. The console "breathes the
actual threat state" without ever turning uncertainty into a protection claim.
Source of truth for behavior: `apps/ui/src/state/threat.ts` (derivation) and
`apps/ui/src/styles/tokens.css` (tone wiring).

## Four separate axes

The interface keeps these strictly independent, as text and icon badges (never
color alone), because conflating them is how false green happens:

| Axis | Values | Source |
| --- | --- | --- |
| Operating mode | `fixture` / `live` | `StatusSnapshot.mode` |
| Risk (latest assessment) | `none_observed` / `info` / `suspicious` / `high` / `unknown` | `Assessment.risk` |
| Coverage (latest assessment) | `complete` / `partial` / `unavailable` | `Assessment.coverage` |
| Freshness | `current` / `stale` (>15 min since `observedAt`) / `expired` (past `expiresAt`) / `unknown` (no reading) | derived from timestamps |

Capability states (`proven` / `partial` / `unavailable` / `untested`) are shown
per tile with a per-state count summary — never collapsed into one score. There
is deliberately no aggregate protection percentage.

## Tone mapping (ambient shell color)

Tone is derived from risk AND coverage together:

| Risk | complete | partial | unavailable |
| --- | --- | --- | --- |
| `high` | danger | danger | danger |
| `suspicious` | warn | warn | warn |
| `info` | info | info | info |
| `none_observed` | **ok** | unknown | unknown |
| `unknown` | unknown | unknown | unknown |

- A clean result with incomplete coverage is **unknown**, not ok — partial
  checks never render as clean.
- "Ok" copy is always qualified: "Completed checks found nothing … not a
  promise that this device is safe."
- Unknown/unavailable uses a neutral desaturated hue and dashed badge borders.
- Critical (danger) stays static and readable — no flashing, no pulsing.
- Tone recolors only the ambient shell treatments (hero border/glow, CRT
  grid, nav chrome, status rail border). Dense reports, warnings and check
  lists always sit on opaque inner surfaces.

## Notifications → awareness dialog

`state/notifications.ts` derives the attention list:

- one notification per assessment, deduplicated by assessment id
- stale/expired readings surface as their own warning
- unavailable capabilities surface once per capability id
- ordering: danger, then warn, then info

Every notification that binds to an assessment opens the reusable
`AwarenessDialog`, which always shows: subject and observation time, risk,
coverage and freshness as separate badges, plain-language reasons, per-check
outcomes, engine versions, evidence references, limitations ("this covers only
the checks listed"), and the safe next step. Actions that require the live
agent are visibly disabled with a tracked-dependency explanation — no silent
no-ops. Dismissed notifications stay recoverable behind a collapsed affordance
with focus restored to the invoking control.

## Accessibility baseline implemented in this increment

- Focus-visible rings; modal focus trap; Escape closes; focus returns to the
  invoking control; skip link to the main landmark.
- `prefers-reduced-motion` removes the CRT sweep and collapses animation
  durations globally; a working **Reduce motion** setting does the same.
- `prefers-reduced-transparency` and a working **Reduce transparency** setting
  replace glass fills with opaque surfaces and remove blur.
- `prefers-contrast: more` strengthens borders/secondary text;
  `forced-colors: active` maps surfaces to system colors and drops effects.
- Ambient animation pauses when the window is hidden.
- Body text ≥14px; 12px is used only for uppercase micro-labels.
- Logical properties for RTL readiness; all strings via `i18n/en.ts` keys
  (Arabic RTL / Hindi / Malayalam translations land at R3).

## Explicitly not yet done (tracked, honestly)

"Connecting"/"unavailable" connection states exist in the status rail but the
live adapter itself awaits Codex LOGIC-01 (#6/#19). Font self-hosting (Inter,
Space Grotesk, JetBrains Mono — OFL reviewed), light-theme visual pass,
200% text-scaling and 400%-reflow manual checks, and NVDA rehearsal are R3-era
polish recorded in the evidence doc, not claimed here.
