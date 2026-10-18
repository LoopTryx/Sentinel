# Small natural-flow ribbon — 17 October 2026

Owner asked to reduce the moving text, keep it only at page bottom rather than pinned to every viewport, touch both content edges, and remove the sidebar slogan/version block. ui-styling and ui-ux-pro-max skills consulted for existing-component reuse, readable type,44px+ interaction area, responsive width and natural scroll behavior.

App moves the footer inside .content after the active view. It scrolls with long pages and uses remaining space on short pages; no fixed/sticky position or overlay. Full-bleed negative inline margins cancel existing content inset without changing other cards' spacing. Bottom inset totals16px. Ribbon is38px with22px bold glyphs inside58px interactive SVG region; edge fading disabled so the band reaches both edges. Removed only decorative THINK/PROTECT/DEFEND and v0.2/Y2K console sidebar footer; no connection/coverage/threat status removed.

TextLoop gains optional fitWidth for non-custom uncrossed line shape. ResizeObserver measures bounded CSS width120..8192px, updates SVG/path/fade bounds and disconnects on unmount. Font stays22 SVG units with matching CSS width and58px height, avoiding giant type at wide sizes or HiDPI. Existing generic shapes/default API and motion controls unchanged; drag uses screen transform. No new animation loop, library, network or native/extension authority.

Focused2files/6tests PASS: prior motion/capture cleanup, new narrow-to-wide font/viewport stability, observer disposal, natural footer placement and sidebar text removal. Source checks cannot prove exact displayed edge alignment; installed resize/HiDPI visual acceptance remains pending, prior browser URL-policy block respected. Engineer A review before coordinator integration; no release/merge.

Code files: apps/ui/src/App.tsx,App.test.tsx,components/ui/TextLoop.tsx,components/text-loop.css,text-loop.test.tsx. Evidence/changelog also updated.

Final tools/verify.ps1 PASS:22 UI files/48tests, native/typecheck/production build/extension smoke. Focused2files/6tests and diff check PASS. Current desktop window must reopen for new UI; installed visual acceptance remains pending.
